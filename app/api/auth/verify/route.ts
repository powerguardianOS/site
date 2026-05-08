export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicToken } from '@/app/lib/magic-link';
import { createSession } from '@/app/lib/session';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/?error=invalid_token', request.url));
  }

  const email = await verifyMagicToken(token);
  if (!email) {
    return NextResponse.redirect(new URL('/?error=invalid_token', request.url));
  }

  const sessionId = await createSession(email);
  const response = NextResponse.redirect(new URL('/account', request.url));
  response.cookies.set('pg_session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  });

  return response;
}
