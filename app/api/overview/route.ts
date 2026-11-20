import { connection } from 'next/server';
import { db } from '@/lib/supabase';
import { errorResponse } from '@/lib/api';

// One call for the whole dashboard: every chatbot plus the latest orders.
export async function GET() {
  await connection();
  try {
    const { data: bots, error: botsError } = await db
      .from('bots')
      .select('id, config, published, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (botsError) throw new Error(botsError.message);

    const customerByBot: Record<string, string> = {};
    const ids = (bots ?? []).map((b) => b.id);
    if (ids.length > 0) {
      const { data: customers, error: customersError } = await db
        .from('customers')
        .select('id, bot_id')
        .in('bot_id', ids);
      if (customersError) throw new Error(customersError.message);
      for (const c of customers ?? []) {
        if (!customerByBot[c.bot_id]) customerByBot[c.bot_id] = c.id;
      }
    }

    const { data: orders, error: ordersError } = await db
      .from('orders')
      .select('id, bot_id, items, subtotal, discount, total, paid_from_wallet, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (ordersError) throw new Error(ordersError.message);

    return Response.json({
      bots: (bots ?? []).map((b) => ({ ...b, customerId: customerByBot[b.id] ?? null })),
      orders: orders ?? [],
    });
  } catch (e) {
    return errorResponse(e, 'overview');
  }
}
