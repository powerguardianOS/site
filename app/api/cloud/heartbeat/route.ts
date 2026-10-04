export const runtime = 'edge';

import { getLicenseByToken, updateLicense } from '@/app/lib/license-db';
import { decideHeartbeat, leaseFor } from '@/app/lib/sitelink';
import { logAudit } from '@/app/lib/audit';
import { dateLong, notifyOwner } from '@/app/lib/notify';
import { getSiteStatus, putSiteStatus } from '@/app/lib/site-status';
import type { SiteDevice, SiteStatus } from '@/app/lib/site-status';

const MAX_BODY = 64 * 1024;
const MAX_DEVICES = 200;
const MIN_INTERVAL_MS = 15_000; // controllers beat every 60 s; anything faster is abuse

const str = (v: unknown, max = 120): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';

const num = (v: unknown, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};

// Called by a controller. Authenticated by its license token (Bearer); the
// token decides which license — and therefore which customer's portal — the
// data lands in. Everything in the body is untrusted and is re-built field by
// field, so nothing the controller sends can add keys, markup or oversize data.
export async function POST(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const license = await getLicenseByToken(token);
  if (!license) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ error: 'payload too large' }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const controllerId = typeof body.controller_id === 'string' && /^[0-9a-f]{32,64}$/i.test(body.controller_id) ? body.controller_id.toLowerCase() : undefined;
  const hostname = str(body.hostname, 63).replace(/[^\w.-]/g, '');
  const now = Math.floor(Date.now() / 1000);

  const d = decideHeartbeat(license, token, controllerId, now);
  if (d.kind === 'denied') return Response.json({ error: d.error, state: d.error }, { status: d.status });

  const name = license.site_name ?? null;

  // Not the holder: it gets a (capped) lease and a notice, but its data is not stored.
  if (d.kind === 'retired') {
    const notice = d.reason === 'moved'
      ? `This site’s license moved to another controller. This controller stops working on ${dateLong(d.leaseUntil)}. Add a license for it, or contact sales@powerguardian.cloud.`
      : `This controller was ${d.reason === 'replaced' ? 'replaced' : 'released'} and stops working on ${dateLong(d.leaseUntil)}.`;
    const lease = await leaseFor(license, controllerId ?? '', d.leaseUntil, 'moved', now, notice);
    return Response.json({ ok: true, lease, lease_valid_until: d.leaseUntil, state: 'moved', site_name: name, notice });
  }
  if (d.kind === 'copy' && controllerId) {
    if (d.isNew) {
      await updateLicense(license.id, { copies: [...(license.copies ?? []), { controller_id: controllerId, hostname, first_seen: new Date(now * 1000).toISOString() }] });
      await logAudit({ actor: 'controller', role: 'controller', action: 'copy.detected', email: license.email, license_id: license.id, detail: `${hostname || controllerId.slice(0, 8)} presents the license of ${name ?? 'a site'} but is not its controller` });
      await notifyOwner(license.email, `A copy of ${name ?? 'your site'} was detected`,
        `A controller (${hostname || 'unnamed'}) is using the license of ${name ?? 'your site'}, but it is not the controller linked to it. This is fine when you copied an SD card or replaced hardware: open your portal and choose Replace, Add a license, or Remove.\n\nUntil you decide it keeps working until ${dateLong(d.leaseUntil)}. Your original controller is not affected.`);
    }
    const notice = d.relink
      ? 'Link this controller to its own site license: Settings → License.'
      : `This controller looks like a copy. Decide in the portal, or here, before ${dateLong(d.leaseUntil)}.`;
    const lease = await leaseFor(license, controllerId, d.leaseUntil, 'unconfirmed_copy', now, notice);
    return Response.json({ ok: true, lease, lease_valid_until: d.leaseUntil, state: 'unconfirmed_copy', site_name: name, notice });
  }

  // The holder (or a legacy controller without a hardware ID).
  const previous = await getSiteStatus(license.id);
  if (previous && Date.now() - previous.received_at < MIN_INTERVAL_MS) {
    return Response.json({ error: 'too frequent' }, { status: 429 });
  }
  if (d.kind === 'holder' && d.adopt && controllerId) {
    await updateLicense(license.id, { claimed_by: controllerId, claimed_hostname: hostname, claimed_at: new Date(now * 1000).toISOString() });
    await logAudit({ actor: 'controller', role: 'controller', action: 'site.adopt', email: license.email, license_id: license.id, detail: `${hostname || controllerId.slice(0, 8)} now holds ${name ?? 'the site'}` });
  }

  const devices: SiteDevice[] = (Array.isArray(body.devices) ? body.devices : [])
    .slice(0, MAX_DEVICES)
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map(d => ({
      name: str(d.name, 80),
      state: str(d.state, 20),
      version: str(d.version, 40),
      ups_status: str(d.ups_status, 40),
      battery_pct: num(d.battery_pct, 0, 100),
      load_pct: num(d.load_pct, 0, 100),
      runtime_sec: num(d.runtime_sec, 0, 10_000_000),
      last_seen: num(d.last_seen, 0, 4_102_444_800),
    }));

  const status: SiteStatus = {
    site_name: str(body.site_name, 80) || 'My site',
    controller_version: str(body.controller_version, 40),
    devices,
    received_at: Date.now(),
  };

  if (!(await putSiteStatus(license.id, status))) {
    return Response.json({ error: 'storage error' }, { status: 502 });
  }
  const lease = d.kind === 'holder' ? await leaseFor(license, controllerId ?? '', d.leaseUntil, 'licensed', now) : null;
  return Response.json({ ok: true, lease, lease_valid_until: d.kind === 'holder' ? d.leaseUntil : undefined, state: 'licensed', site_name: name });
}
