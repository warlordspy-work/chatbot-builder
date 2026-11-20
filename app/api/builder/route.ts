import { connection } from 'next/server';
import { generate } from '@/lib/gemini';
import { db } from '@/lib/supabase';
import { errorResponse } from '@/lib/api';

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
  await connection();
  try {
    const { prompt, menuText } = await req.json();
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return Response.json({ error: 'Please describe your business first.' }, { status: 400 });
    }

    const response = await generate({
      contents: `Owner description:
${prompt}

Menu:
${menuText ?? ''}`,
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
        { error: 'The AI did not return a valid setup. Please try again.' },
        { status: 502 }
      );
    }

    // Make sure the screens always get the shape they expect
    config.features = {
      menuOrdering: !!config.features?.menuOrdering,
      wallet: !!config.features?.wallet,
      vouchers: !!config.features?.vouchers,
    };
    config.menu = Array.isArray(config.menu) ? config.menu : [];

    const { data: bot, error } = await db
      .from('bots')
      .insert({ owner_prompt: prompt, config })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Save the voucher the owner asked for
    if (config.voucher && config.voucher.code) {
      await db.from('vouchers').insert({
        bot_id: bot.id,
        code: String(config.voucher.code).toUpperCase(),
        percent_off: Number(config.voucher.percentOff) || 0,
        first_order_only: !!config.voucher.firstOrderOnly,
      });
    }

    // Create a demo customer with 500 rupees in the wallet
    const { data: customer, error: customerError } = await db
      .from('customers')
      .insert({ bot_id: bot.id, name: 'Demo Customer', wallet_balance: 500 })
      .select()
      .single();
    if (customerError) throw new Error(customerError.message);

    return Response.json({ bot, customer });
  } catch (e) {
    return errorResponse(e, 'builder');
  }
}
