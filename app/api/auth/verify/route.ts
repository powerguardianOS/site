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
  // CLOUD-SSO: a controller sent this browser to sign in first (app/sso/authorize). Go back there; the request is checked
  // again in full, so the cookie can only ever point at the authorize page.
  const ssoNext = request.cookies.get('pg_sso_next')?.value ?? '';
  const target = ssoNext ? '/sso/authorize?' + new URLSearchParams(ssoNext).toString() : '/account';
  const response = NextResponse.redirect(new URL(target, request.url));
  if (ssoNext) response.cookies.set('pg_sso_next', '', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0, path: '/' });
  response.cookies.set('pg_session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  });

  return response;
}
