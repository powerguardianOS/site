import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail = request.headers.get('cf-access-authenticated-user-email');

  if (!adminEmail || !userEmail || userEmail !== adminEmail) {
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
