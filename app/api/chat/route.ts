import { Type } from '@google/genai';
import type { Content, Tool } from '@google/genai';
import { ai, MODEL } from '@/lib/gemini';
import { db } from '@/lib/supabase';

type MenuItem = { name: string; price: number };
type OrderItem = { name: string; qty: number };

// The tools Gemini is allowed to ask for
const tools: Tool[] = [
  {
    functionDeclarations: [
      { name: 'get_menu', description: 'Get the menu with prices in rupees.' },
      { name: 'check_wallet', description: 'Get the customer wallet balance in rupees.' },
      {
        name: 'validate_voucher',
        description: 'Check whether a discount code is valid for this customer.',
        parameters: {
          type: Type.OBJECT,
          properties: { code: { type: Type.STRING } },
          required: ['code'],
        },
      },
      {
        name: 'place_order',
        description: 'Place the order after the customer has confirmed the items.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                },
                required: ['name', 'qty'],
              },
            },
            voucher_code: { type: Type.STRING },
            pay_with_wallet: { type: Type.BOOLEAN },
          },
          required: ['items'],
        },
      },
    ],
  },
];

/**
 * Executes a tool function called by Gemini (e.g. get_menu, check_wallet, validate_voucher, place_order).
 *
 * @param name - The name of the tool function to execute
 * @param args - Arguments passed by the model
 * @param botId - The unique identifier of the chatbot
 * @param customerId - The unique identifier of the customer
 * @param menu - The bot's menu items
 * @returns An object containing tool output results
 */
async function runTool(
  name: string,
  args: Record<string, unknown>,
  botId: string,
  customerId: string,
  menu: MenuItem[]
): Promise<Record<string, unknown>> {
  if (name === 'get_menu') return { menu };

  if (name === 'check_wallet') {
    const { data } = await db
      .from('customers')
      .select('wallet_balance')
      .eq('id', customerId)
      .single();
    return { balance: Number(data?.wallet_balance ?? 0) };
  }

  if (name === 'validate_voucher') {
    const code = String(args.code ?? '').toUpperCase();
    const { data: v } = await db
      .from('vouchers')
      .select('*')
      .eq('bot_id', botId)
      .eq('code', code)
      .eq('active', true)
      .maybeSingle();
    if (!v) return { valid: false, reason: 'Unknown or inactive code' };
    if (v.first_order_only) {
      const { count } = await db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId);
      if ((count ?? 0) > 0) {
        return { valid: false, reason: 'Only valid on a first order' };
      }
    }
    return { valid: true, percentOff: v.percent_off };
  }

  if (name === 'place_order') {
    const items = (args.items as OrderItem[]) ?? [];
    let subtotal = 0;
    for (const it of items) {
      const m = menu.find(
        (x) => x.name.toLowerCase() === String(it.name).toLowerCase()
      );
      if (!m) return { ok: false, reason: `Not on the menu: ${it.name}` };
      subtotal += m.price * Number(it.qty);
    }

    let discount = 0;
    if (args.voucher_code) {
      const check = await runTool(
        'validate_voucher',
        { code: args.voucher_code },
        botId,
        customerId,
        menu
      );
      if (check.valid) {
        discount = Math.round(subtotal * Number(check.percentOff)) / 100;
      }
    }
    const total = subtotal - discount;

    const payWallet = args.pay_with_wallet === true;
    if (payWallet) {
      const { data: c } = await db
        .from('customers')
        .select('wallet_balance')
        .eq('id', customerId)
        .single();
      const balance = Number(c?.wallet_balance ?? 0);
      if (balance < total) {
        return { ok: false, reason: 'Not enough wallet balance', balance, total };
      }
      // Fine for a prototype. A real product needs a database transaction here.
      await db
        .from('customers')
        .update({ wallet_balance: balance - total })
        .eq('id', customerId);
    }

    await db.from('orders').insert({
      bot_id: botId,
      customer_id: customerId,
      items,
      subtotal,
      discount,
      total,
      paid_from_wallet: payWallet,
    });
    return { ok: true, subtotal, discount, total, paidFromWallet: payWallet };
  }

  return { error: 'Unknown tool' };
}

/**
 * POST handler for customer chat messages.
 * Orchestrates multi-turn function calling with Gemini and handles tool executions.
 */
export async function POST(req: Request) {
  const { botId, customerId, history, message } = await req.json();

  const { data: bot } = await db
    .from('bots')
    .select('config')
    .eq('id', botId)
    .single();
  if (!bot) return Response.json({ error: 'Bot not found' }, { status: 404 });
  const config = bot.config;
  const menu: MenuItem[] = config.menu ?? [];

  const system = `You are the WhatsApp assistant for ${config.businessName}. Tone: ${config.tone}.
Rules:
- Use the tools for the menu, prices, vouchers, wallet and orders. Never guess prices or balances.
- Only offer features that are switched on: ${JSON.stringify(config.features)}.
- Use the exact item names from get_menu when calling place_order.
- Before calling place_order, confirm the items and the total with the customer.
- Keep replies short, like a WhatsApp message.`;

  const contents: Content[] = [
    ...(history ?? []).map((h: { role: string; text: string }) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  // Let Gemini ask for tools, run them, and give the answers back (max 5 rounds)
  for (let i = 0; i < 5; i++) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: system, tools },
    });

    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      const { data: c } = await db
        .from('customers')
        .select('wallet_balance')
        .eq('id', customerId)
        .single();
      return Response.json({
        reply: response.text,
        balance: Number(c?.wallet_balance ?? 0),
      });
    }

    contents.push(response.candidates![0].content!);
    const results = [];
    for (const call of calls) {
      const output = await runTool(
        call.name!,
        (call.args ?? {}) as Record<string, unknown>,
        botId,
        customerId,
        menu
      );
      results.push({ functionResponse: { name: call.name!, response: { output } } });
    }
    contents.push({ role: 'user', parts: results });
  }

  return Response.json({ reply: 'Sorry, something went wrong. Please try again.' });
}