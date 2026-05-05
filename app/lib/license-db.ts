export type LicenseRecord = {
  id: string;
  email: string;
  plan: "home" | "pro" | "enterprise" | "lifetime" | "founder";
  connector_limit: number;
  expires_at: string | null;
  status: "active" | "revoked" | "expired";
  notes: string;
  created_at: string;
  token: string;
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

export async function getLicenseByEmail(email: string): Promise<LicenseRecord | null> {
  const licenses = await getLicenses();
  return licenses.find(l => l.email.toLowerCase() === email.toLowerCase() && l.status === 'active') ?? null;
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
