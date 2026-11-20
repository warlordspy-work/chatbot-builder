import { db } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const botId = url.searchParams.get('id');
  const customerId = url.searchParams.get('customer');

  const { data: bot } = await db
    .from('bots')
    .select('config')
    .eq('id', botId)
    .single();
  const { data: c } = await db
    .from('customers')
    .select('wallet_balance')
    .eq('id', customerId)
    .single();

  return Response.json({
    config: bot?.config,
    balance: Number(c?.wallet_balance ?? 0),
  });
}