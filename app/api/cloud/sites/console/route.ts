export const runtime = 'edge';

import { getLicensesByEmail } from '@/app/lib/license-db';
import { holderCaller } from '@/app/lib/controller-auth';
import { getSiteStatus, isOnline } from '@/app/lib/site-status';
import { consolePlan, mintConsoleURL } from '@/app/lib/relay-mint';
import { createSwitchTicket } from '@/app/lib/console-switch';
import { privateIPv4 } from '@/app/lib/sso';
import { APEX_HOST } from '@/app/lib/host';

// Where the browser opens a switch ticket: the apex host; a local test stack on loopback answers on the address the
// controller called (its Host header), so the controller's exact check of the link holds there too.
function cloudOrigin(request: Request): string {
  const u = new URL(request.url);
  const host = (request.headers.get('host') ?? '').toLowerCase();
  if (/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host)) return `${u.protocol}//${host}`;
  return `https://${APEX_HOST}`;
}

// Called by a controller whose site switcher opens another site of the same account through the relay (the page
// itself is on the relay, or the other site is not on this network): the same short-lived console link as the
// portal's Open Console. Only a site of the caller's own account, only on a plan with the remote console, only
// while it is online.
export async function POST(request: Request) {
  const license = await holderCaller(request);
  if (license instanceof Response) return license;

  const body = await request.json().catch(() => null) as { site_id?: unknown; actor?: unknown; via?: unknown } | null;
  const id = typeof body?.site_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.site_id) ? body.site_id : '';
  if (!id) return Response.json({ error: 'site_id required' }, { status: 400 });

  const site = (await getLicensesByEmail(license.email)).find((l) => l.id === id && l.plan !== 'addon_connector');
  if (!site) return Response.json({ error: 'not_found' }, { status: 404 });
  const actor = typeof body?.actor === 'string' ? body.actor.trim().toLowerCase() : '';
  const owner = license.email.toLowerCase();
  const linked = !!actor && actor === owner && site.email.toLowerCase() === owner;
  const status = await getSiteStatus(site.id);

  // AUTO-SSO on the LAN: the switcher opens the site at its LAN address and still lands signed in. Only a switch ticket
  // (no relay link, so the plan does not matter), only for the linked owner, only to a private address the site itself
  // reported.
  if (body?.via === 'lan') {
    if (!linked) return Response.json({ error: 'not_linked' }, { status: 403 });
    const lan = (status?.lan ?? []).find((a) => privateIPv4(a));
    if (!lan || !isOnline(status)) return Response.json({ error: 'no_lan' }, { status: 409 });
    const t = await createSwitchTicket(site.id, owner, Date.now(), lan).catch(() => '');
    if (!t) return Response.json({ error: 'unavailable' }, { status: 503 });
    return Response.json({ open_url: `${cloudOrigin(request)}/console/open?t=${t}` }, { headers: { 'cache-control': 'no-store' } });
  }

  if (!consolePlan(site.plan)) return Response.json({ error: 'console_not_in_plan' }, { status: 403 });
  if (!isOnline(status)) return Response.json({ error: 'offline' }, { status: 409 });

  const m = await mintConsoleURL(site.id, license.email);
  if ('error' in m) return Response.json({ error: m.error }, { status: m.status });
  // AUTO-SSO: the controller's user is linked to the account that owns both licences (actor): also a switch ticket, so
  // the browser lands signed in on that site (app/lib/console-switch.ts). Anyone else: the console link only.
  let open_url: string | undefined;
  if (linked) {
    const t = await createSwitchTicket(site.id, owner).catch(() => '');
    if (t) open_url = `${cloudOrigin(request)}/console/open?t=${t}`;
  }
  return Response.json({ console_url: m.url, ...(open_url ? { open_url } : {}) }, { headers: { 'cache-control': 'no-store' } });
}
