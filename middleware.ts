import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // CF Access injects this header on page requests
  const emailHeader = request.headers.get('cf-access-authenticated-user-email');
  // CF Access sets this cookie after authentication (used by browser API calls)
  const cfCookie = request.cookies.get('CF_Authorization')?.value;

  if (!emailHeader && !cfCookie) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
