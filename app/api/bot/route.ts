import { connection } from 'next/server';
import { db } from '@/lib/supabase';
import { errorResponse } from '@/lib/api';

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const botId = url.searchParams.get('id');
    const customerId = url.searchParams.get('customer');

    const { data: bot } = await db
      .from('bots')
      .select('config, published')
      .eq('id', botId)
      .single();
    const { data: c } = await db
      .from('customers')
      .select('wallet_balance')
      .eq('id', customerId)
      .single();

    return Response.json({
      config: bot?.config,
      published: !!bot?.published,
      balance: Number(c?.wallet_balance ?? 0),
    });
  } catch (e) {
    return errorResponse(e, 'bot.get');
  }
}

// Switch features on or off, or publish the chatbot
export async function PATCH(req: Request) {
  await connection();
  try {
    const { botId, features, published } = await req.json();
    if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 });

    const { data: bot, error } = await db
      .from('bots')
      .select('config, published')
      .eq('id', botId)
      .single();
    if (error || !bot) return Response.json({ error: 'Chatbot not found' }, { status: 404 });

    const current = bot.config?.features ?? {};
    const next = { ...current };
    for (const key of ['menuOrdering', 'wallet', 'vouchers']) {
      if (features && typeof features[key] === 'boolean') next[key] = features[key];
    }
    const config = { ...bot.config, features: next };

    const update: Record<string, unknown> = { config };
    if (typeof published === 'boolean') update.published = published;

    const { error: updateError } = await db.from('bots').update(update).eq('id', botId);
    if (updateError) throw new Error(updateError.message);

    return Response.json({
      ok: true,
      config,
      published: typeof published === 'boolean' ? published : !!bot.published,
    });
  } catch (e) {
    return errorResponse(e, 'bot.patch');
  }
}
