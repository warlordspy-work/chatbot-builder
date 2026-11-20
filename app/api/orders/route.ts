import { connection } from 'next/server';
import { db } from '@/lib/supabase';
import { errorResponse } from '@/lib/api';
import { requireSession } from '@/lib/auth';

export async function GET(req: Request) {
  await connection();
  const session = requireSession(req);
  if (session instanceof Response) return session;
  try {
    const botId = new URL(req.url).searchParams.get('botId');
    const { data, error } = await db
      .from('orders')
      .select('*')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return Response.json({ orders: data ?? [] });
  } catch (e) {
    return errorResponse(e, 'orders');
  }
}
