import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APEX_HOST, WWW_HOST } from '@/app/lib/host';

export function middleware(request: NextRequest) {
  // LOGIN-1: one host. www.powerguardian.cloud → powerguardian.cloud (permanent, path and query kept), so the
  // session cookie and the sign-in link always live on the same host.
  const host = (request.headers.get('host') ?? request.nextUrl.host).toLowerCase().replace(/:\d+$/, '');
  if (host === WWW_HOST) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(`https://${APEX_HOST}${pathname}${search}`, 308);
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/account') || pathname.startsWith('/admin')) {
    const session = request.cookies.get('pg_session')?.value;
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Every path (www must redirect everywhere) except Next's own build assets.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
