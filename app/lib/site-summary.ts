import { getSiteStatus, isOnline } from '@/app/lib/site-status';
import type { SiteStatus } from '@/app/lib/site-status';

// One reading of a site's state, shared by the portal ("My sites") and the controller's site switcher
// (/api/cloud/sites), so both show the same thing.

export type PowerLevel = 'danger' | 'warn' | 'ok' | 'none' | 'other';

// NUT status tokens → plain language. Order matters: the worst state wins.
export function power(raw: string): { label: string; level: PowerLevel } {
  const s = raw.toUpperCase();
  if (!s) return { label: 'No UPS data', level: 'none' };
  if (s.includes('LB')) return { label: 'Low battery', level: 'danger' };
  if (s.includes('OB')) return { label: 'On battery', level: 'warn' };
  if (s.includes('RB')) return { label: 'Replace battery', level: 'warn' };
  if (s.includes('OL')) return { label: 'On mains', level: 'ok' };
  return { label: raw, level: 'other' };
}

// offline: no heartbeat in the online window (or never). Otherwise the worst UPS: low battery = danger;
// on battery, replace battery or a connector that is offline = warn; else ok.
export type SiteTone = 'ok' | 'warn' | 'danger' | 'offline';
export function siteTone(status: SiteStatus | null, now = Date.now()): SiteTone {
  if (!isOnline(status, now)) return 'offline';
  let tone: SiteTone = 'ok';
  for (const d of status!.devices) {
    const lv = power(d.ups_status).level;
    if (lv === 'danger') return 'danger';
    if (lv === 'warn' || d.state !== 'online') tone = 'warn';
  }
  return tone;
}

// The sites (not the connector add-ons) of the given licences with their last heartbeat.
export async function sitesWithStatus<L extends { id: string; plan: string }>(licenses: L[]): Promise<{ lic: L; status: SiteStatus | null }[]> {
  const sites = licenses.filter((l) => l.plan !== 'addon_connector');
  const statuses = await Promise.all(sites.map((l) => getSiteStatus(l.id)));
  return sites.map((lic, i) => ({ lic, status: statuses[i] }));
}

// LAN addresses a controller may report: private IPv4 only (10/8, 172.16/12, 192.168/16), at most 4.
// Public, CGNAT, link-local and loopback addresses never reach the cloud.
export function privateLan(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const a of v) {
    if (typeof a !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(a)) continue;
    const o = a.split('.').map(Number);
    if (o.some((n) => n > 255)) continue;
    const ok = o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168);
    if (ok && !out.includes(a)) out.push(a);
    if (out.length === 4) break;
  }
  return out;
}
