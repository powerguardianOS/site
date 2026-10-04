import { getSiteStatus } from '@/app/lib/site-status';

export type LicenseRecord = {
  id: string;
  email: string;
  plan: "home" | "pro" | "founder" | "addon_connector";
  site_id: string;
  connector_limit: number;
  expires_at: string | null;
  status: "active" | "revoked" | "expired";
  notes: string;
  created_at: string;
  token: string;
  // Only for plan 'addon_connector': the id of the site license it extends.
  parent_id?: string;

  // --- site naming, linking and the 30-day lease (site licenses only) ---
  addon_ids?: string[];       // the connector add-ons of this site, so a heartbeat reads only these
  site_name?: string;
  claimed_by?: string;        // hardware ID of the controller that holds this site
  claimed_hostname?: string;
  claimed_at?: string;
  moved_at?: string;          // last transfer, for the once-per-30-days rule
  retired?: Retired[];        // controllers that used to hold the site, on a capped lease
  copies?: Copy[];            // unconfirmed copies seen with this license's token
  offline_allowed?: boolean;  // set by the admin: may get a 12-month offline lease
};

// A controller that no longer holds the site. Its lease ends at `until`.
export type Retired = {
  controller_id: string | null; // null = a controller that predates hardware IDs
  token: string | null;
  until: string;
  reason: 'moved' | 'replaced' | 'released';
  at: string;
};

// A controller that presented this license's token but is not its holder
// (a copied SD card, for instance). It runs on a countdown until the customer decides.
export type Copy = {
  controller_id: string;
  hostname: string;
  first_seen: string;
  decision?: 'relink' | 'removed';
};

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

async function kvGet(key: string): Promise<string | null> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`KV read failed (${r.status})`);
  return r.text();
}

async function kvPut(key: string, value: string): Promise<void> {
  await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'text/plain' },
    body: value,
  });
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getLicenses(): Promise<LicenseRecord[]> {
  const idsJson = await kvGet('index:all');
  if (!idsJson) return [];
  const ids: string[] = JSON.parse(idsJson);
  const records = await Promise.all(
    ids.map(id => kvGet(`license:${id}`).then(v => (v ? JSON.parse(v) as LicenseRecord : null)))
  );
  return records.filter(Boolean) as LicenseRecord[];
}

export async function getLicensesByEmail(email: string): Promise<LicenseRecord[]> {
  const licenses = await getLicenses();
  return licenses.filter(l => l.email.toLowerCase() === email.toLowerCase() && l.status === 'active');
}

export async function getAccountSummary(email: string): Promise<{email: string, licenses: LicenseRecord[], total_connectors: number, total_sites: number}> {
  const licenses = await getLicensesByEmail(email);
  const total_connectors = licenses.reduce((sum, l) => sum + l.connector_limit, 0);
  // Add-on licenses extend a site's connector allowance; they are not sites.
  const site_ids = new Set(licenses.filter(l => l.plan !== 'addon_connector').map(l => l.id));
  return {
    email,
    licenses,
    total_connectors,
    total_sites: site_ids.size
  };
}

export async function getLicenseByEmail(email: string): Promise<LicenseRecord | null> {
  const licenses = await getLicenses();
  return licenses.find(l => l.email.toLowerCase() === email.toLowerCase() && l.status === 'active') ?? null;
}

// Which license a controller gets when it links by e-mail. A customer can hold
// several site licenses (one per controller): hand out one that no controller
// has reported on yet, so a second controller does not share the first one's
// token (the relay keys a controller by its token). Re-linking a controller that
// already reports keeps working only while no unlinked license is waiting.
export async function getLinkableLicense(email: string): Promise<LicenseRecord | null> {
  const mine = (await getLicenses())
    .filter(l => l.email.toLowerCase() === email.toLowerCase() && l.status === 'active' && l.plan !== 'addon_connector')
    .filter(l => !l.expires_at || new Date(l.expires_at).getTime() > Date.now())
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const l of mine) {
    if (!(await getSiteStatus(l.id))) return l;
  }
  return mine[0] ?? null;
}

export async function getLicenseByToken(token: string): Promise<LicenseRecord | null> {
  const id = await kvGet(`index:token:${token.toLowerCase()}`);
  if (!id) return null;
  const json = await kvGet(`license:${id}`);
  if (!json) return null;
  return JSON.parse(json);
}

export async function createLicense(
  data: Omit<LicenseRecord, 'id' | 'created_at' | 'token' | 'status'>
): Promise<LicenseRecord> {
  const record: LicenseRecord = {
    ...data,
    id: crypto.randomUUID(),
    status: 'active',
    created_at: new Date().toISOString(),
    token: randomHex(16),
    site_id: 'default-site',
  };

  await kvPut(`license:${record.id}`, JSON.stringify(record));
  await kvPut(`index:token:${record.token.toLowerCase()}`, record.id);

  const idsJson = await kvGet('index:all');
  const ids: string[] = idsJson ? JSON.parse(idsJson) : [];
  ids.push(record.id);
  await kvPut('index:all', JSON.stringify(ids));

  return record;
}

export async function updateLicense(id: string, patch: Partial<LicenseRecord>): Promise<LicenseRecord | null> {
  const json = await kvGet(`license:${id}`);
  if (!json) return null;
  const updated = { ...JSON.parse(json) as LicenseRecord, ...patch };
  await kvPut(`license:${id}`, JSON.stringify(updated));
  return updated;
}

export async function revokeLicense(id: string): Promise<boolean> {
  const json = await kvGet(`license:${id}`);
  if (!json) return false;
  const record = JSON.parse(json) as LicenseRecord;
  record.status = 'revoked';
  await kvPut(`license:${id}`, JSON.stringify(record));
  return true;
}

export async function deleteLicense(id: string): Promise<boolean> {
  const json = await kvGet(`license:${id}`);
  if (!json) return false;
  const record = JSON.parse(json) as LicenseRecord;
  // Remove token index
  await fetch(`${BASE()}/values/${encodeURIComponent(`index:token:${record.token.toLowerCase()}`)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN()}` },
  });
  // Remove record
  await fetch(`${BASE()}/values/${encodeURIComponent(`license:${id}`)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN()}` },
  });
  // Remove from ID list
  const idsJson = await kvGet('index:all');
  if (idsJson) {
    const ids: string[] = JSON.parse(idsJson).filter((i: string) => i !== id);
    await kvPut('index:all', JSON.stringify(ids));
  }
  return true;
}

export async function regenToken(id: string): Promise<LicenseRecord | null> {
  const json = await kvGet(`license:${id}`);
  if (!json) return null;
  const record = JSON.parse(json) as LicenseRecord;
  // Remove old token index
  await fetch(`${BASE()}/values/${encodeURIComponent(`index:token:${record.token.toLowerCase()}`)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN()}` },
  });
  // Generate new token
  record.token = randomHex(16);
  await kvPut(`license:${id}`, JSON.stringify(record));
  await kvPut(`index:token:${record.token.toLowerCase()}`, id);
  return record;
}

// Gives the license a new token and keeps the old token's index, so a controller
// that still holds the old token can be recognised (and gradually retired).
export async function rotateTokenKeepOld(id: string): Promise<{ old: string; next: string; record: LicenseRecord } | null> {
  const json = await kvGet(`license:${id}`);
  if (!json) return null;
  const record = JSON.parse(json) as LicenseRecord;
  const old = record.token;
  record.token = randomHex(16);
  await kvPut(`license:${id}`, JSON.stringify(record));
  await kvPut(`index:token:${record.token.toLowerCase()}`, id);
  return { old, next: record.token, record };
}

export async function getLicense(id: string): Promise<LicenseRecord | null> {
  const json = await kvGet(`license:${id}`);
  return json ? (JSON.parse(json) as LicenseRecord) : null;
}
