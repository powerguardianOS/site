export const runtime = 'edge';

// LOGIN-2: GET, polled every ~2 s by the "Check your inbox" tab. Bound to this browser's pending sign-in (pg_login_req
// cookie) and answers only {state: pending | done | expired}: no email, no target. "done" = the link was opened in this
// browser and its cookies have arrived here (pg_login_done); the tab then goes to /api/auth/continue.
import { NextResponse } from 'next/server';
import { signInState } from '@/app/lib/signin-code';

export async function GET(request: Request) {
  return NextResponse.json({ state: await signInState(request) }, { headers: { 'Cache-Control': 'no-store' } });
}
