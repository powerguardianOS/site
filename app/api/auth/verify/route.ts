export const runtime = 'edge';

// LOGIN-1. The link in the sign-in mail lands here.
//   GET  ?token=…  shows "Sign in as r***@gmail.com" with one button. It does NOT use the link up: mail scanners,
//                  link previews (Gmail, Outlook, Brevo click tracking) and browser prefetch all GET links first.
//   POST token     the button. Same-origin only. Uses the link up, creates the session, sets pg_session, → /account.
// A used, expired or unknown link goes to /login?error=link, which says so and offers a new link.
import { NextRequest, NextResponse } from 'next/server';
import { peekMagicToken, consumeMagicToken, maskEmail } from '@/app/lib/magic-link';
import { createSession } from '@/app/lib/session';
import { page, esc, sameOrigin } from '@/app/lib/page-html';
import { getSession } from '@/app/lib/session';

// Already signed in (a double tap on Sign in, where the second POST wins in the browser, or an old mail link opened
// later): go to the account instead of "expired". Sessions only exist after the full sign-in, MFA included.
const linkProblem = async (request: NextRequest) => {
  const cookie = request.cookies.get('pg_session')?.value;
  const signedIn = cookie ? await getSession(cookie).catch(() => null) : null;
  return NextResponse.redirect(new URL(signedIn ? '/account' : '/login?error=link', request.url), { status: 303, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
};

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const email = token ? await peekMagicToken(token) : null;
  if (!email) return linkProblem(request);
  return page(200, 'Sign in to PowerGuardian',
    `<p>Sign in as <b id="signin-email">${esc(maskEmail(email))}</b></p>` +
    `<form method="post" action="/api/auth/verify" class="card">` +
    `<input type="hidden" name="token" value="${esc(token)}">` +
    `<button type="submit" id="signin-confirm">Sign in</button>` +
    `<p class="small" style="margin-top:12px">Not you, or you did not ask for this? Close this page. Nothing happens until you tap Sign in.</p>` +
    `</form>`);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return page(403, 'Open the link from your email again',
      '<p>This sign-in did not start on this page. Tap the button in the sign-in email again.</p><p><a href="/login">Back to sign in</a></p>');
  }
  const form = await request.formData().catch(() => null);
  const token = String(form?.get('token') ?? '');
  const email = token ? await consumeMagicToken(token) : null;
  if (!email) return linkProblem(request);

  const cookie = await createSession(email);
  const response = NextResponse.redirect(new URL('/account', request.url), { status: 303, headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set('pg_session', cookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 86400,
    path: '/',
  });
  return response;
}
