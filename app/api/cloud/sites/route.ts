export const runtime = 'edge';

import { getLicenseByToken, getLicensesByEmail } from '@/app/lib/license-db';
import { decideHeartbeat } from '@/app/lib/sitelink';
import { withRoot } from '@/app/lib/founder';
import { siteTone, sitesWithStatus } from '@/app/lib/site-summary';

// Called by a controller for its site switcher: the sites of its own account. Authenticated like the
// heartbeat (license token as Bearer, hardware ID in X-Controller-Id), and only the holder of a site gets
// the list — a copy or a retired controller does not. Per site only what the switcher shows: no tokens,
// e-mail, hardware IDs or hostnames, and the same status reading as the portal (lib/site-summary.ts).
export async function GET(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const found = await getLicenseByToken(token);
  const license = found && await withRoot(found);
  if (!license) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const raw = request.headers.get('x-controller-id') ?? '';
  const controllerId = /^[0-9a-f]{32,64}$/i.test(raw) ? raw.toLowerCase() : undefined;
  const d = decideHeartbeat(license, token, controllerId, Math.floor(Date.now() / 1000));
  if (d.kind === 'denied') return Response.json({ error: d.error }, { status: d.status });
  if (d.kind !== 'holder') return Response.json({ error: 'not_holder' }, { status: 403 });

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
      this: lic.id === license.id,
    };
  });
  return Response.json({ sites }, { headers: { 'cache-control': 'no-store' } });
}
