export const runtime = 'edge';

// LOGIN-2: where the "Check your inbox" tab goes once /api/auth/status says done: to the target remembered when the
// link was used (account, a controller's sign-in, a site switch), or to the two-step page when that comes first (the
// pending step cookie is shared by both tabs). Ends this browser's pending sign-in. Nothing to do → /login.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { STEP_PATH } from '@/app/lib/signin-step';
import { requestIdOf, getSignInRequest, dropSignInRequest, doneSeen, reqCookie, doneCookie } from '@/app/lib/signin-code';

// Only a path on this site (signInTarget only ever stores those; checked again anyway).
const localPath = (p: string | undefined) => (p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/\\') ? p : '/account');

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('pg_session')?.value;
  const signedIn = cookie ? !!(await getSession(cookie).catch(() => null)) : false;
  const id = await requestIdOf(request);
  const rec = id ? await getSignInRequest(id) : null;
  const done = rec?.state === 'done' && doneSeen(request);
  const to = done ? (signedIn ? localPath(rec.next) : STEP_PATH) : signedIn ? '/account' : '/login';
  const res = NextResponse.redirect(new URL(to, request.url), { status: 303, headers: { 'Cache-Control': 'no-store' } });
  if (done) {
    await dropSignInRequest(id);
    res.headers.append('Set-Cookie', reqCookie('', 0));
    res.headers.append('Set-Cookie', doneCookie(0));
  }
  return res;
}
