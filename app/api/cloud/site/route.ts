export const runtime = 'edge';

import { getLicenseByToken, updateLicense } from '@/app/lib/license-db';
import { decideHeartbeat } from '@/app/lib/sitelink';
import { logAudit } from '@/app/lib/audit';

// The controller renames its own site. Only the holder may; the cloud owns the
// name and every other view (portal, admin, the next heartbeat) follows it.
export async function PATCH(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const license = token ? await getLicenseByToken(token) : null;
  if (!license) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as { name?: unknown; controller_id?: unknown } | null;
  const cid = typeof body?.controller_id === 'string' && /^[0-9a-f]{32,64}$/i.test(body.controller_id) ? body.controller_id.toLowerCase() : undefined;
  const d = decideHeartbeat(license, token, cid, Math.floor(Date.now() / 1000));
  if (d.kind !== 'holder') return Response.json({ error: 'not_holder' }, { status: 403 });

  const name = typeof body?.name === 'string' ? body.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) : '';
  if (!name) return Response.json({ error: 'name required' }, { status: 400 });
  await updateLicense(license.id, { site_name: name });
  await logAudit({ actor: 'controller', role: 'controller', action: 'site.rename', email: license.email, license_id: license.id, detail: name });
  return Response.json({ ok: true, site_name: name });
}
