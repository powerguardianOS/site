export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/app/lib/session';

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('pg_session')?.value;
  if (sessionId) {
    await deleteSession(sessionId);
  }

  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set('pg_session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
