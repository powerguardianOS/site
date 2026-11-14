export const runtime = 'edge';

// AUTO-SSO: a controller's site switcher sends the browser here with a switch ticket (app/lib/console-switch.ts).
// The browser's own PG Cloud session must be the account the ticket was made for; without a session it signs in first
// and comes back (pg_open_next, read by /api/auth/verify). Then the ticket is burned, the site's console link is minted
// like the portal's Open Console, the console intent is set and the browser lands on the site's console, where the
// controller signs in by itself.
import { getSessionInfo } from '@/app/lib/session';
import { getLicensesByEmail } from '@/app/lib/license-db';
import { mintConsoleURL } from '@/app/lib/relay-mint';
import { mintConsoleIntent } from '@/app/lib/console-intent';
import { peekSwitchTicket, burnSwitchTicket, TICKET_RE, SWITCH_TTL_S } from '@/app/lib/console-switch';
import { ssoHtml, esc, privateIPv4 } from '@/app/lib/sso';

function cookie(request: Request, name: string): string {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

const expired = () => ssoHtml(410, 'This link has expired',
  '<p style="color:#9aa4b2">Open the site again from the site switcher of your controller, or from your account.</p>' +
  '<p><a href="/account" style="color:#00c66f">Go to my account</a></p>');

export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get('t') ?? '';
  const ticket = TICKET_RE.test(t) ? await peekSwitchTicket(t) : null;
  if (!ticket) return expired();

  const sid = cookie(request, 'pg_session');
  const who = sid ? await getSessionInfo(sid).catch(() => null) : null;
  if (!who) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/login?next=console',
        'Set-Cookie': `pg_open_next=${t}; Path=/; Max-Age=${SWITCH_TTL_S}; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store',
      },
    });
  }
  const email = who.email.toLowerCase();
  if (email !== ticket.email) {
    return ssoHtml(403, 'This link is for another account',
      `<p style="color:#9aa4b2">You are signed in to PowerGuardian Cloud as <b>${esc(email)}</b>. This site was opened for another account.</p>` +
      '<p><a href="/account" style="color:#00c66f">Go to my account</a></p>');
  }
  // still this account's site (it may have moved since the ticket was made)
  const site = (await getLicensesByEmail(email)).find((l) => l.id === ticket.site_id && l.plan !== 'addon_connector');
  if (!site) {
    return ssoHtml(403, 'No access to this site', '<p style="color:#9aa4b2">This site is no longer on your account.</p><p><a href="/account" style="color:#00c66f">Go to my account</a></p>');
  }
  await burnSwitchTicket(t);
  if (ticket.lan) {
    if (!privateIPv4(ticket.lan)) return expired();
    // the site switcher on the LAN: to the address the site reported, which then signs in by itself (?sso=auto)
    const intent = await mintConsoleIntent(site.id, sid).catch(() => null);
    const h = new Headers({ Location: `https://${ticket.lan}/?sso=auto`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    if (intent) h.append('Set-Cookie', intent);
    h.append('Set-Cookie', 'pg_open_next=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    return new Response(null, { status: 303, headers: h });
  }
  const m = await mintConsoleURL(site.id, email);
  if ('error' in m) {
    return ssoHtml(502, 'The site could not be opened', '<p style="color:#9aa4b2">PowerGuardian Cloud could not reach it right now. Try again from your controller.</p>');
  }
  const intent = await mintConsoleIntent(site.id, sid).catch(() => null);
  const headers = new Headers({ Location: m.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  if (intent) headers.append('Set-Cookie', intent);
  headers.append('Set-Cookie', 'pg_open_next=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  return new Response(null, { status: 303, headers });
}
