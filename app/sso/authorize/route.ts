export const runtime = 'edge';

// CLOUD-SSO step 2 (see app/lib/sso.ts): GET shows "Sign in to <site>?" for a signed-in owner of that controller's
// site (or sends the browser to the login first); POST (the Continue button, same origin only) signs the statement and
// sends the browser back to the controller. No statement ever goes to a controller of another account.
import { getSessionInfo, type SessionInfo } from '@/app/lib/session';
import { sameOrigin } from '@/app/lib/page-html';
import { parseSSORequest, ssoSiteFor, ssoReturnFitsSite, ssoIsConsoleOrigin, buildAssertion, signSSO, ssoHtml, esc } from '@/app/lib/sso';
import { intentCookieName, consumeConsoleIntent, clearConsoleIntent } from '@/app/lib/console-intent';

const NEXT_COOKIE = 'pg_sso_next';

function cookie(request: Request, name: string): string {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

const bad = () => ssoHtml(400, 'This sign-in link is not valid',
  '<p style="color:#9aa4b2">Start again from the sign-in page of your controller.</p>');

async function signedIn(request: Request): Promise<(SessionInfo & { sid: string }) | null> {
  const sid = cookie(request, 'pg_session');
  const s = sid ? await getSessionInfo(sid) : null;
  return s ? { email: s.email.toLowerCase(), mfa: s.mfa, sid } : null;
}

// The controller's own sign-in page, with ?sso=… so it does not start the cloud sign-in by itself again (AUTO-SSO).
const backLink = (origin: string, why: 'failed' | 'cancel', text: string) =>
  `<a href="${esc(origin)}/?sso=${why}" style="color:#9aa4b2">${esc(text)}</a>`;

function noAccess(email: string, origin?: string) {
  return ssoHtml(403, 'No access to this controller',
    `<p style="color:#9aa4b2">The PowerGuardian Cloud account <b>${esc(email)}</b> does not own the site of this controller, so it cannot sign in there.</p>` +
    `<p style="color:#9aa4b2">Sign in on the controller with its own username and password, or sign in here with the account that owns the site.</p>` +
    `<p><a href="/account" style="color:#00c66f">Go to my account</a></p>` +
    (origin ? `<p>${backLink(origin, 'failed', 'Back to the sign-in page of the controller')}</p>` : ''));
}

async function sendBack(req: { ret: string }, token: string, extra: Record<string, string> = {}) {
  return new Response(null, {
    status: 303,
    headers: { Location: `${req.ret}?assertion=${encodeURIComponent(token)}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...extra },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const req = parseSSORequest(url.searchParams);
  if (!req) return bad();
  const who = await signedIn(request);
  const email = who?.email;
  if (!who || !email) {
    // Not signed in: remember this request for 15 minutes and sign in first; /api/auth/verify brings the browser back.
    const q = new URLSearchParams({ controller: req.controller, nonce: req.nonce, return: req.ret }).toString();
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/login?next=sso',
        'Set-Cookie': `${NEXT_COOKIE}=${encodeURIComponent(q)}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store',
      },
    });
  }
  const site = await ssoSiteFor(email, req.controller);
  if (!site) return noAccess(email, req.origin);
  if (!(await ssoReturnFitsSite(req.origin, site.id))) return bad();

  // AUTO-SSO: started by Open Console moments ago (a console intent for this site and this session): no Continue tap,
  // when the session passed two-step sign-in and the browser goes back to this site's own console host. The intent
  // is burned at this first try, whatever the outcome; without it, or when anything does not hold: the Continue page.
  const intentName = await intentCookieName(site.id);
  const intent = cookie(request, intentName);
  let clear: Record<string, string> = {};
  if (intent) {
    clear = { 'Set-Cookie': await clearConsoleIntent(site.id) };
    const fetchSite = (request.headers.get('sec-fetch-site') ?? '').toLowerCase();
    if (await consumeConsoleIntent(intent, site.id, who.sid) && who.mfa && ssoIsConsoleOrigin(req.origin) && fetchSite !== 'cross-site') {
      const token = await signSSO(buildAssertion(email, site, req, undefined, true));
      if (token) return sendBack(req, token, clear);
    }
  }

  const name = site.site_name || 'your site';
  const host = new URL(req.origin).host;
  const page = ssoHtml(200, `Sign in to ${name}`,
    `<p style="color:#9aa4b2;line-height:1.5">Sign in to the PowerGuardian controller of <b style="color:#e6edf3">${esc(name)}</b> as <b style="color:#e6edf3">${esc(email)}</b>.</p>` +
    `<p style="color:#9aa4b2;line-height:1.5">You go back to <b style="color:#e6edf3" id="sso-host">${esc(host)}</b>. Only continue if you just tapped "Sign in with PowerGuardian Cloud" there.</p>` +
    `<form method="post" action="/sso/authorize" style="margin-top:24px">` +
    `<input type="hidden" name="controller" value="${esc(req.controller)}"><input type="hidden" name="nonce" value="${esc(req.nonce)}"><input type="hidden" name="return" value="${esc(req.ret)}">` +
    `<button type="submit" id="sso-continue" style="width:100%;padding:14px;border:0;border-radius:10px;background:#00c66f;color:#04140b;font-size:16px;font-weight:600">Continue</button></form>` +
    `<p style="text-align:center;margin-top:16px"><a href="/account" style="color:#9aa4b2">Cancel</a></p>` +
    `<p style="text-align:center;margin-top:8px">${backLink(req.origin, 'cancel', 'Sign in on the controller instead')}</p>`);
  if (clear['Set-Cookie']) page.headers.append('Set-Cookie', clear['Set-Cookie']);
  return page;
}

export async function POST(request: Request) {
  // Same-origin form only: another site cannot make a signed-in browser hand out a statement.
  if (!sameOrigin(request)) {
    return ssoHtml(403, 'This sign-in was not started here', '<p style="color:#9aa4b2">Start again from the sign-in page of your controller.</p>');
  }
  const form = await request.formData().catch(() => null);
  if (!form) return bad();
  const p = new URLSearchParams();
  for (const k of ['controller', 'nonce', 'return']) p.set(k, String(form.get(k) ?? ''));
  const req = parseSSORequest(p);
  if (!req) return bad();
  const who = await signedIn(request);
  const email = who?.email;
  if (!who || !email) return ssoHtml(401, 'Sign in first', '<p style="color:#9aa4b2">Your PowerGuardian Cloud session ended. Start again from your controller.</p>');
  const site = await ssoSiteFor(email, req.controller);
  if (!site) return noAccess(email, req.origin);
  if (!(await ssoReturnFitsSite(req.origin, site.id))) return bad();
  const token = await signSSO(buildAssertion(email, site, req, undefined, who.mfa));
  if (!token) return ssoHtml(503, 'Sign-in is not available right now', '<p style="color:#9aa4b2">Sign in on the controller with its own username and password.</p>');
  return sendBack(req, token);
}
