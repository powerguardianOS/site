import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/account')) {
    const session = request.cookies.get('pg_session')?.value;
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const adminToken = process.env.ADMIN_TOKEN;
    const cookie = request.cookies.get('admin_token')?.value;

    // Already authenticated
    if (adminToken && cookie === adminToken) return NextResponse.next();

    // Login form POST: ?token=xxx
    if (request.method === 'GET' && pathname === '/admin/login') return NextResponse.next();

    // Redirect to login
    if (!adminToken || cookie !== adminToken) {
      if (pathname.startsWith('/api/admin')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/account/:path*'],
};
