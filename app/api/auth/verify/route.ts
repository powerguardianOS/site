export const runtime = 'edge';

// LOGIN-1. The link in the sign-in mail lands here.
//   GET  ?token=…  shows "Sign in as r***@gmail.com" with one button. It does NOT use the link up: mail scanners,
//                  link previews (Gmail, Outlook, Brevo click tracking) and browser prefetch all GET links first.
//   POST token     the button. Same-origin only. Uses the link up, creates the session, sets pg_session, → /account.
//                  (CLOUD-MFA: or first to /login/mfa for the authenticator code, see app/lib/signin-step.ts.)
// LOGIN-2: opened in the browser that asked (its pg_login_req cookie matches the link's pending sign-in), the GET signs
// in at once: "You're signed in" (or on to the two-step page), and the tab that asked goes on by itself. A scanner never
// has that cookie, so for it (and for any other device) the GET stays side-effect free and shows the button.
// A used, expired or unknown link goes to /login?error=link, which says so and offers a new link.
import { NextRequest, NextResponse } from 'next/server';
import { peekMagicToken, consumeMagicToken, maskEmail, type MagicLink } from '@/app/lib/magic-link';
import { afterLinkConfirmed, signInTarget, clearSignInNext, STEP_PATH } from '@/app/lib/signin-step';
import { page, esc, sameOrigin, CSP } from '@/app/lib/page-html';
import { getSession } from '@/app/lib/session';
import { requestIdOf, getSignInRequest, markSignInDone, dropSignInRequest, doneCookie, sameHex } from '@/app/lib/signin-code';

// Already signed in (a double tap on Sign in, where the second POST wins in the browser, or an old mail link opened
// later): go to the account instead of "expired". Sessions only exist after the full sign-in, MFA included.
const linkProblem = async (request: NextRequest) => {
  const cookie = request.cookies.get('pg_session')?.value;
  const signedIn = cookie ? await getSession(cookie).catch(() => null) : null;
  return NextResponse.redirect(new URL(signedIn ? '/account' : '/login?error=link', request.url), { status: 303, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
};

// Does this browser hold the link's pending sign-in?
const sameBrowser = async (request: NextRequest, link: MagicLink) => {
  const id = link.req ? await requestIdOf(request) : '';
  return id && sameHex(id, link.req!) ? id : '';
};

// Uses the link up and signs in. In the browser that asked, the pending sign-in becomes "done" (that tab follows);
// from another device it is dropped (its code dies with it).
async function spendLink(request: NextRequest, token: string): Promise<{ res: NextResponse; same: boolean } | null> {
  const link = await consumeMagicToken(token);
  if (!link) return null;
  const id = await sameBrowser(request, link);
  // CLOUD-SSO: a controller sent this browser to sign in first (app/sso/authorize). Go back there; the request is checked
  // again in full, so the cookie can only ever point at the authorize page.
  // (AUTO-SSO: or on to a site switch ticket, app/console/open; see signInTarget)
  // CLOUD-MFA: with two-step sign-in (or when it must be set up) the session is only made after the code.
  const next = signInTarget(request);
  const res = await afterLinkConfirmed(request, link.email, next);
  clearSignInNext(request, res);
  if (id) {
    const rec = await getSignInRequest(id);
    if (rec) await markSignInDone(id, rec, next);
    res.headers.append('Set-Cookie', doneCookie());
  } else if (link.req) {
    await dropSignInRequest(link.req);
  }
  return { res, same: !!id };
}

// Tells the tab that asked (same browser) at once; it also polls /api/auth/status.
const NUDGE = "try{new BroadcastChannel('pg-login').postMessage('done')}catch(e){}";
async function scriptHash(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return 'sha256-' + btoa(String.fromCharCode(...new Uint8Array(d)));
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const link = token ? await peekMagicToken(token) : null;
  if (!link) return linkProblem(request);

  if (await sameBrowser(request, link)) {
    const used = await spendLink(request, token);
    if (!used) return linkProblem(request);
    const loc = new URL(used.res.headers.get('location') ?? '/account', request.url);
    if (loc.pathname === STEP_PATH) return used.res; // two-step sign-in: on to the code, as with the button
    const done = page(200, "You're signed in",
      `<p id="signin-done">You can close this page.</p>` +
      `<p class="small" style="margin-top:20px"><a href="/account" id="signin-my-sites" style="color:#a1a1aa">Go to My sites</a></p>` +
      `<script>${NUDGE}</script>`,
      { 'Content-Security-Policy': CSP.replace("default-src 'none';", `default-src 'none'; script-src '${await scriptHash(NUDGE)}';`) });
    const out = new NextResponse(done.body, done);
    for (const c of used.res.headers.getSetCookie()) out.headers.append('Set-Cookie', c);
    return out;
  }

  return page(200, 'Sign in to PowerGuardian',
    `<p>Sign in as <b id="signin-email">${esc(maskEmail(link.email))}</b></p>` +
    `<form method="post" action="/api/auth/verify" class="card">` +
    `<input type="hidden" name="token" value="${esc(token)}">` +
    `<button type="submit" id="signin-confirm">Sign in on this device</button>` +
    `<p class="small" style="margin-top:12px" id="signin-code-hint">Or type the code from the email on the device where you asked.</p>` +
    `</form>` +
    `<p class="small" style="margin-top:16px">Not you, or you did not ask for this? Close this page. Nothing happens until you tap the button.</p>`);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return page(403, 'Open the link from your email again',
      '<p>This sign-in did not start on this page. Tap the button in the sign-in email again.</p><p><a href="/login">Back to sign in</a></p>');
  }
  const form = await request.formData().catch(() => null);
  const token = String(form?.get('token') ?? '');
  const used = token ? await spendLink(request, token) : null;
  return used ? used.res : linkProblem(request);
}
