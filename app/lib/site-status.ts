import type { PowerHistory } from '@/app/lib/power-history';
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
export type SiteDevice = {
  name: string;
  state: string;
  version: string;
  ups_status: string;
  battery_pct: number;
  load_pct: number;
  runtime_sec: number;
  last_seen: number; // unix seconds, as reported by the controller
};

export type SiteStatus = {
  site_name: string;
  controller_version: string;
  devices: SiteDevice[];
  received_at: number; // ms, set by the cloud — never trusted from the controller
  model?: string;      // the controller's hardware ("HP ProDesk 400 G3 DM"); absent in beats from before SITE-2
  lan?: string[];      // its private LAN addresses, for the site switcher of the account's other controllers
  power?: PowerHistory; // ACCOUNT-UI: 24 h power history (lib/power-history.ts), carried from beat to beat
};

// A controller heartbeats every 60 s; three missed beats = offline.
export const ONLINE_WINDOW_MS = 180_000;
const RETAIN_SECONDS = 7 * 24 * 3600; // keep "last seen" for a week, then forget


const key = (licenseId: string) => `sitestatus:${licenseId}`;

export async function getSiteStatus(licenseId: string): Promise<SiteStatus | null> {
  const raw = await kvGet(key(licenseId)).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SiteStatus;
  } catch {
    return null;
  }
}

export async function putSiteStatus(licenseId: string, status: SiteStatus): Promise<boolean> {
  return kvPut(key(licenseId), JSON.stringify(status), RETAIN_SECONDS).then(() => true, () => false);
}

export function isOnline(s: SiteStatus | null, now = Date.now()): boolean {
  return !!s && now - s.received_at < ONLINE_WINDOW_MS;
}

export async function deleteSiteStatus(licenseId: string): Promise<void> {
  await kvDel(key(licenseId));
}
