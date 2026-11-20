import { ai, MODEL } from '@/lib/gemini';
import { db } from '@/lib/supabase';

const INSTRUCTIONS = `You set up WhatsApp chatbots for small businesses.
Read the owner's description and menu. Reply with ONLY a JSON object with these fields:
- businessName: text
- greeting: a short friendly first message for customers
- tone: one short phrase, like friendly and casual
- features: an object with three true/false fields: menuOrdering, wallet, vouchers
- menu: a list of objects, each with name (text) and price (number in rupees)
- voucher: null, or an object with code (UPPERCASE text), percentOff (number) and firstOrderOnly (true/false)
Only turn a feature on if the owner asked for it. Do not invent menu items.`;

export async function POST(req: Request) {
  const { prompt, menuText } = await req.json();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Owner description:
${prompt}

Menu:
${menuText}`,
    config: {
      systemInstruction: INSTRUCTIONS,
      responseMimeType: 'application/json',
    },
  });

  let config;
  try {
    config = JSON.parse(response.text ?? '');
  } catch {
    return Response.json(
      { error: 'Gemini did not return valid JSON. Please try again.' },
      { status: 502 }
    );
  }

  const { data: bot, error } = await db
    .from('bots')
    .insert({ owner_prompt: prompt, config })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Save the voucher the owner asked for
  if (config.voucher) {
    await db.from('vouchers').insert({
      bot_id: bot.id,
      code: String(config.voucher.code).toUpperCase(),
      percent_off: config.voucher.percentOff,
      first_order_only: !!config.voucher.firstOrderOnly,
    });
  }

  // Create a demo customer with 500 rupees in the wallet
  const { data: customer } = await db
    .from('customers')
    .insert({ bot_id: bot.id, name: 'Demo Customer', wallet_balance: 500 })
    .select()
    .single();

  return Response.json({ bot, customer });
}