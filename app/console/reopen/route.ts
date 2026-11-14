export const runtime = 'edge';

// REOPEN: the relay sends a page load on a site's console host without a valid console session (refresh or new tab
// after the ten-minute console token expired) here: /console/reopen?site=<16 hex label>&path=<same-host path>.
// Without a PG Cloud session the browser signs in first and comes back (pg_reopen_next, read by signInTarget). Then,
// only for a site of the signed-in account itself, a fresh console link is minted exactly like Open Console (with the
// AUTO-SSO console intent) and the browser lands back on the same page of that console. Any other label — another
// account's site or none at all — gets the same 404, so the page never tells whether a site exists.
import { getSessionInfo } from '@/app/lib/session';
import { getLicensesByEmail } from '@/app/lib/license-db';
import { consolePlan, mintConsoleURL, siteLabel } from '@/app/lib/relay-mint';
import { mintConsoleIntent } from '@/app/lib/console-intent';
import { logConsoleAccess } from '@/app/lib/shares';
import { rateLimited } from '@/app/lib/ratelimit';
import { LABEL_RE, REOPEN_NEXT_COOKIE, safeConsolePath } from '@/app/lib/console-reopen';
import { ssoHtml } from '@/app/lib/sso';

const REOPEN_PER_10_MIN = 30;
const NEXT_TTL_S = 600;

function cookie(request: Request, name: string): string {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) { try { return decodeURIComponent(v.join('=')); } catch { return ''; } }
  }
  return '';
}

const back = '<p><a href="/account" style="color:#00c66f">Go to my account</a></p>';
const notOnAccount = () => ssoHtml(404, 'This site is not on your account',
  '<p style="color:#9aa4b2">Open your sites from your PowerGuardian Cloud account.</p>' + back);

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const label = q.get('site') ?? '';
  const path = safeConsolePath(q.get('path'));
  if (!LABEL_RE.test(label)) return notOnAccount();

  const sid = cookie(request, 'pg_session');
  const who = sid ? await getSessionInfo(sid).catch(() => null) : null;
  if (!who) {
    const next = new URLSearchParams({ site: label, path }).toString();
    const h = new Headers({ Location: '/login?next=console', 'Cache-Control': 'no-store' });
    h.append('Set-Cookie', `${REOPEN_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=${NEXT_TTL_S}; HttpOnly; Secure; SameSite=Lax`);
    return new Response(null, { status: 303, headers: h });
  }
  const email = who.email.toLowerCase();

  // minting a console credential: fail closed, like sign-in
  let limited = true;
  try { limited = await rateLimited(`reopen:email:${email}`, REOPEN_PER_10_MIN, 600, true); } catch { limited = true; }
  if (limited) {
    const r = ssoHtml(429, 'Too many attempts', '<p style="color:#9aa4b2">Wait a few minutes and open the site again.</p>' + back);
    r.headers.set('Retry-After', '600');
    return r;
  }

  let site = null;
  for (const l of await getLicensesByEmail(email)) {
    if (l.plan !== 'addon_connector' && await siteLabel(l.id) === label) { site = l; break; }
  }
  if (!site) return notOnAccount();
  if (!consolePlan(site.plan)) {
    return ssoHtml(403, 'No remote console for this site', '<p style="color:#9aa4b2">The remote console is not in this site\'s plan.</p>' + back);
  }

  const m = await mintConsoleURL(site.id, email);
  if ('error' in m) {
    return ssoHtml(502, 'The site could not be opened', '<p style="color:#9aa4b2">PowerGuardian Cloud could not reach it right now. Try again in a moment.</p>' + back);
  }
  const intent = await mintConsoleIntent(site.id, sid).catch(() => null);
  await logConsoleAccess(email, site.id, 'reopen', site.email);
  const h = new Headers({ Location: m.url + (path === '/' ? '' : path), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  if (intent) h.append('Set-Cookie', intent);
  h.append('Set-Cookie', `${REOPEN_NEXT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return new Response(null, { status: 303, headers: h });
}
