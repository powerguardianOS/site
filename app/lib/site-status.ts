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
};

// A controller heartbeats every 60 s; three missed beats = offline.
export const ONLINE_WINDOW_MS = 180_000;
const RETAIN_SECONDS = 7 * 24 * 3600; // keep "last seen" for a week, then forget

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

const key = (licenseId: string) => `sitestatus:${licenseId}`;

export async function getSiteStatus(licenseId: string): Promise<SiteStatus | null> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key(licenseId))}`, {
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (!r.ok) return null;
  try {
    return JSON.parse(await r.text()) as SiteStatus;
  } catch {
    return null;
  }
}

export async function putSiteStatus(licenseId: string, status: SiteStatus): Promise<boolean> {
  const r = await fetch(
    `${BASE()}/values/${encodeURIComponent(key(licenseId))}?expiration_ttl=${RETAIN_SECONDS}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
      body: JSON.stringify(status),
    },
  );
  return r.ok;
}

export function isOnline(s: SiteStatus | null, now = Date.now()): boolean {
  return !!s && now - s.received_at < ONLINE_WINDOW_MS;
}

export async function deleteSiteStatus(licenseId: string): Promise<void> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key(licenseId))}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (!r.ok && r.status !== 404) throw new Error(`KV delete failed (${r.status})`);
}
