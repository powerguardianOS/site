export const runtime = 'edge';

import { getLicensesByEmail } from '@/app/lib/license-db';
import { holderCaller } from '@/app/lib/controller-auth';
import { getSiteStatus, isOnline } from '@/app/lib/site-status';
import { consolePlan, mintConsoleURL } from '@/app/lib/relay-mint';

// Called by a controller whose site switcher opens another site of the same account through the relay (the page
// itself is on the relay, or the other site is not on this network): the same short-lived console link as the
// portal's Open Console. Only a site of the caller's own account, only on a plan with the remote console, only
// while it is online.
export async function POST(request: Request) {
  const license = await holderCaller(request);
  if (license instanceof Response) return license;

  const body = await request.json().catch(() => null) as { site_id?: unknown } | null;
  const id = typeof body?.site_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.site_id) ? body.site_id : '';
  if (!id) return Response.json({ error: 'site_id required' }, { status: 400 });

  const site = (await getLicensesByEmail(license.email)).find((l) => l.id === id && l.plan !== 'addon_connector');
  if (!site) return Response.json({ error: 'not_found' }, { status: 404 });
  if (!consolePlan(site.plan)) return Response.json({ error: 'console_not_in_plan' }, { status: 403 });
  if (!isOnline(await getSiteStatus(site.id))) return Response.json({ error: 'offline' }, { status: 409 });

  const m = await mintConsoleURL(site.id, license.email);
  if ('error' in m) return Response.json({ error: m.error }, { status: m.status });
  return Response.json({ console_url: m.url }, { headers: { 'cache-control': 'no-store' } });
}
