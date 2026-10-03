export const runtime = 'edge';

import { getLicenseByToken } from '@/app/lib/license-db';
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
  if (!license || license.status !== 'active') {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
    return Response.json({ error: 'license expired' }, { status: 403 });
  }

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

  const previous = await getSiteStatus(license.id);
  if (previous && Date.now() - previous.received_at < MIN_INTERVAL_MS) {
    return Response.json({ error: 'too frequent' }, { status: 429 });
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
  return Response.json({ ok: true });
}
