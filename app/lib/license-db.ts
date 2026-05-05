import { getRequestContext } from '@cloudflare/next-on-pages';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getKV(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { env } = getRequestContext() as any;
  return env.LICENSES;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getLicenses(): Promise<LicenseRecord[]> {
  const kv = getKV();
  const idsJson: string | null = await kv.get('index:all');
  if (!idsJson) return [];
  const ids: string[] = JSON.parse(idsJson);
  const records = await Promise.all(
    ids.map((id: string) => kv.get(`license:${id}`).then((v: string | null) => v ? JSON.parse(v) as LicenseRecord : null))
  );
  return (records as (LicenseRecord | null)[]).filter(Boolean) as LicenseRecord[];
}

export async function getLicenseByToken(token: string): Promise<LicenseRecord | null> {
  const kv = getKV();
  const id: string | null = await kv.get(`index:token:${token.toLowerCase()}`);
  if (!id) return null;
  const json: string | null = await kv.get(`license:${id}`);
  if (!json) return null;
  return JSON.parse(json);
}

export async function createLicense(data: Omit<LicenseRecord, 'id' | 'created_at' | 'token' | 'status'>): Promise<LicenseRecord> {
  const kv = getKV();
  const record: LicenseRecord = {
    ...data,
    id: crypto.randomUUID(),
    status: 'active',
    created_at: new Date().toISOString(),
    token: randomHex(16),
  };

  await kv.put(`license:${record.id}`, JSON.stringify(record));
  await kv.put(`index:token:${record.token.toLowerCase()}`, record.id);

  const idsJson: string | null = await kv.get('index:all');
  const ids: string[] = idsJson ? JSON.parse(idsJson) : [];
  ids.push(record.id);
  await kv.put('index:all', JSON.stringify(ids));

  return record;
}

export async function updateLicense(id: string, patch: Partial<LicenseRecord>): Promise<LicenseRecord | null> {
  const kv = getKV();
  const json: string | null = await kv.get(`license:${id}`);
  if (!json) return null;
  const updated = { ...JSON.parse(json) as LicenseRecord, ...patch };
  await kv.put(`license:${id}`, JSON.stringify(updated));
  return updated;
}

export async function revokeLicense(id: string): Promise<boolean> {
  const kv = getKV();
  const json: string | null = await kv.get(`license:${id}`);
  if (!json) return false;
  const record = JSON.parse(json) as LicenseRecord;
  record.status = 'revoked';
  await kv.put(`license:${id}`, JSON.stringify(record));
  return true;
}
