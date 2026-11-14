import { getLicenseByToken } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { decideHeartbeat } from '@/app/lib/sitelink';
import { withRoot } from '@/app/lib/founder';

// A controller calling the cloud about its account (site switcher): authenticated like the heartbeat — its license
// token as Bearer and its hardware ID in X-Controller-Id — and only the holder of a site; a copy or a retired
// controller is refused. Returns the caller's license, or the Response to send.
export async function holderCaller(request: Request): Promise<LicenseRecord | Response> {
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
  return license;
}
