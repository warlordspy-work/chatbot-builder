import { connection } from 'next/server';
import { db } from '@/lib/supabase';
import { errorResponse } from '@/lib/api';
import { ownerScope, requireSession } from '@/lib/auth';

// One call for the whole dashboard: every chatbot plus the latest orders.
export async function GET(req: Request) {
  await connection();
  const session = requireSession(req);
  if (session instanceof Response) return session;
  try {
    const { data: bots, error: botsError } = await db
      .from('bots')
      .select('id, config, published, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (botsError) throw new Error(botsError.message);
    const scope = ownerScope(session);
    const mine = (bots ?? []).filter((b) => scope === null || b.config?.ownerId === scope);

    const customerByBot: Record<string, string> = {};
    const ids = mine.map((b) => b.id);
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
      bots: mine.map((b) => ({ ...b, customerId: customerByBot[b.id] ?? null })),
      orders: (orders ?? []).filter((o) => ids.includes(o.bot_id)),
    });
  } catch (e) {
    return errorResponse(e, 'overview');
  }
}
