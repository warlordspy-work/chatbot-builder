import { connection } from 'next/server';
import { COOKIE } from '@/lib/auth';

export async function POST() {
  await connection();
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
