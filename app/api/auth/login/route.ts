import { connection } from 'next/server';
import { COOKIE, checkLogin, cookieOptions, createToken } from '@/lib/auth';

export async function POST(req: Request) {
  await connection();
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const role = checkLogin(String(body.username ?? ''), String(body.password ?? ''));
  if (!role) {
    await new Promise((r) => setTimeout(r, 700)); // slows down password guessing
    return Response.json({ error: 'Wrong username or password.' }, { status: 401 });
  }
  const res = Response.json({ ok: true, user: String(body.username), role });
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '');
  const c = cookieOptions(proto === 'https');
  res.headers.append(
    'Set-Cookie',
    `${COOKIE}=${createToken(String(body.username), role)}; Path=${c.path}; Max-Age=${c.maxAge}; HttpOnly; SameSite=Lax${c.secure ? '; Secure' : ''}`
  );
  return res;
}
