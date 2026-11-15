export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, getSession } from '@/app/lib/session';
import { logAudit } from '@/app/lib/audit';
import { activityCtx } from '@/app/lib/client-info';

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('pg_session')?.value;
  if (sessionId) {
    const email = await getSession(sessionId).catch(() => null);
    await deleteSession(sessionId); // SESSIONS-1: a tombstone, so the cookie is dead at once (also within the fresh grace)
    if (email) await logAudit({ actor: email.toLowerCase(), role: 'owner', action: 'auth.signout', email: email.toLowerCase(), ...activityCtx(request) });
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
