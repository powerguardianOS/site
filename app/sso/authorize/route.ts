export const runtime = 'edge';

// CLOUD-SSO step 2 (see app/lib/sso.ts): GET shows "Sign in to <site>?" for a signed-in owner of that controller's
// site (or sends the browser to the login first); POST (the Continue button, same origin only) signs the statement and
// sends the browser back to the controller. No statement ever goes to a controller of another account.
import { getSession } from '@/app/lib/session';
import { parseSSORequest, ssoSiteFor, buildAssertion, signSSO, ssoHtml, esc } from '@/app/lib/sso';

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

async function signedInEmail(request: Request): Promise<string | null> {
  const sid = cookie(request, 'pg_session');
  const email = sid ? await getSession(sid) : null;
  return email ? email.toLowerCase() : null;
}

function noAccess(email: string) {
  return ssoHtml(403, 'No access to this controller',
    `<p style="color:#9aa4b2">The PowerGuardian Cloud account <b>${esc(email)}</b> does not own the site of this controller, so it cannot sign in there.</p>` +
    `<p style="color:#9aa4b2">Sign in on the controller with its own username and password, or sign in here with the account that owns the site.</p>` +
    `<p><a href="/account" style="color:#00c66f">Go to my account</a></p>`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const req = parseSSORequest(url.searchParams);
  if (!req) return bad();
  const email = await signedInEmail(request);
  if (!email) {
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
  if (!site) return noAccess(email);
  const name = site.site_name || 'your site';
  const host = new URL(req.origin).host;
  return ssoHtml(200, `Sign in to ${name}`,
    `<p style="color:#9aa4b2;line-height:1.5">Sign in to the PowerGuardian controller of <b style="color:#e6edf3">${esc(name)}</b> as <b style="color:#e6edf3">${esc(email)}</b>.</p>` +
    `<p style="color:#9aa4b2;line-height:1.5">You go back to <b style="color:#e6edf3" id="sso-host">${esc(host)}</b>. Only continue if you just tapped "Sign in with PowerGuardian Cloud" there.</p>` +
    `<form method="post" action="/sso/authorize" style="margin-top:24px">` +
    `<input type="hidden" name="controller" value="${esc(req.controller)}"><input type="hidden" name="nonce" value="${esc(req.nonce)}"><input type="hidden" name="return" value="${esc(req.ret)}">` +
    `<button type="submit" id="sso-continue" style="width:100%;padding:14px;border:0;border-radius:10px;background:#00c66f;color:#04140b;font-size:16px;font-weight:600">Continue</button></form>` +
    `<p style="text-align:center;margin-top:16px"><a href="/account" style="color:#9aa4b2">Cancel</a></p>`);
}

export async function POST(request: Request) {
  // Same-origin form only: another site cannot make a signed-in browser hand out a statement.
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) {
    return ssoHtml(403, 'This sign-in was not started here', '<p style="color:#9aa4b2">Start again from the sign-in page of your controller.</p>');
  }
  const form = await request.formData().catch(() => null);
  if (!form) return bad();
  const p = new URLSearchParams();
  for (const k of ['controller', 'nonce', 'return']) p.set(k, String(form.get(k) ?? ''));
  const req = parseSSORequest(p);
  if (!req) return bad();
  const email = await signedInEmail(request);
  if (!email) return ssoHtml(401, 'Sign in first', '<p style="color:#9aa4b2">Your PowerGuardian Cloud session ended. Start again from your controller.</p>');
  const site = await ssoSiteFor(email, req.controller);
  if (!site) return noAccess(email);
  const token = await signSSO(buildAssertion(email, site, req));
  if (!token) return ssoHtml(503, 'Sign-in is not available right now', '<p style="color:#9aa4b2">Sign in on the controller with its own username and password.</p>');
  return new Response(null, {
    status: 303,
    headers: { Location: `${req.ret}?assertion=${encodeURIComponent(token)}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
