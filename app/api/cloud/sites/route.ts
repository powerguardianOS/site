export const runtime = 'edge';

import { getLicensesByEmail } from '@/app/lib/license-db';
import { holderCaller } from '@/app/lib/controller-auth';
import { siteTone, sitesWithStatus } from '@/app/lib/site-summary';
import { consolePlan } from '@/app/lib/relay-mint';

// Called by a controller for its site switcher: the sites of its own account (lib/controller-auth.ts: only the
// holder of a site, authenticated like the heartbeat). Per site only what the switcher shows: no tokens,
// e-mail, hardware IDs or hostnames, and the same status reading as the portal (lib/site-summary.ts).
export async function GET(request: Request) {
  const license = await holderCaller(request);
  if (license instanceof Response) return license;

  const now = Date.now();
  const list = await sitesWithStatus(await getLicensesByEmail(license.email));
  const sites = list.map(({ lic, status }) => {
    const tone = siteTone(status, now);
    return {
      id: lic.id,
      name: lic.site_name ?? status?.site_name ?? null,
      model: status?.model ?? '',
      controller_version: status?.controller_version ?? '',
      online: tone !== 'offline',
      tone,
      last_seen: status ? status.received_at : null,
      lan: status?.lan ?? [],
      console: consolePlan(lic.plan), // the remote console through the relay is in its plan
      this: lic.id === license.id,
    };
  });
  return Response.json({ sites }, { headers: { 'cache-control': 'no-store' } });
}
