import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Simple signed-cookie login. No extra packages.
// Today there is one universal account (admin). Later each paying business gets its own owner id.
export const COOKIE = 'cb_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Session = { u: string; r: 'admin' | 'owner'; exp: number };

function secret(): string {
  const base = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_KEY || 'dev-only-secret';
  return createHash('sha256').update('cb-auth:' + base).digest('hex');
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sig = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function createToken(user: string, role: Session['r']): string {
  const payload = b64(JSON.stringify({ u: user, r: role, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  return `${payload}.${sig(payload)}`;
}

export function verifyToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sig(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function sessionFromRequest(req: Request): Session | null {
  return verifyToken(readCookie(req.headers.get('cookie'), COOKIE));
}

// Use at the top of any protected API route: const s = requireSession(req); if (s instanceof Response) return s;
export function requireSession(req: Request): Session | Response {
  const s = sessionFromRequest(req);
  return s ?? Response.json({ error: 'Please sign in.' }, { status: 401 });
}

// null = may see everything (universal admin). Otherwise only bots owned by this id.
export function ownerScope(s: Session): string | null {
  return s.r === 'admin' ? null : s.u;
}

const h = (x: string) => createHash('sha256').update(x).digest();
export function checkLogin(user: string, pass: string): Session['r'] | null {
  const u = process.env.ADMIN_USER || 'admin';
  const p = process.env.ADMIN_PASSWORD || 'admin';
  const okU = timingSafeEqual(h(user), h(u));
  const okP = timingSafeEqual(h(pass), h(p));
  return okU && okP ? 'admin' : null;
}

export function cookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: MAX_AGE };
}
