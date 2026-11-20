import { db } from '@/lib/supabase';

export async function GET(req: Request) {
  const botId = new URL(req.url).searchParams.get('botId');
  const { data } = await db
    .from('orders')
    .select('*')
    .eq('bot_id', botId)
    .order('created_at', { ascending: false });
  return Response.json({ orders: data ?? [] });
}