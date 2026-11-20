import { connection } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  await connection();
  const s = sessionFromRequest(req);
  return s ? Response.json({ user: s.u, role: s.r }) : Response.json({ error: 'Please sign in.' }, { status: 401 });
}
