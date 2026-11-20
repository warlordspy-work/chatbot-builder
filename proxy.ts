import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE, verifyToken } from '@/lib/auth';

// Everything needs a login except the customer chat and the login page itself.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/chat/') ||
    pathname === '/api/chat' ||
    pathname === '/api/auth/login' ||
    (pathname === '/api/bot' && req.method === 'GET'); // the customer chat reads the bot config

  if (isPublic || verifyToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};
