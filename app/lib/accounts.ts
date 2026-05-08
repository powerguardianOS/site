export const runtime = 'edge';

export type AccountRecord = { email: string; created_at: string; verified: boolean };

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () => `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

async function kvGet(key: string): Promise<string | null> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${TOKEN()}` } });
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

export async function createAccount(email: string): Promise<AccountRecord> {
  const record: AccountRecord = { email: email.toLowerCase(), created_at: new Date().toISOString(), verified: false };
  await kvPut(`account:${email.toLowerCase()}`, JSON.stringify(record));
  return record;
}

export async function getAccount(email: string): Promise<AccountRecord | null> {
  const raw = await kvGet(`account:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

export async function getAccounts(): Promise<AccountRecord[]> {
  const r = await fetch(`${BASE()}/keys?prefix=account%3A&limit=1000`, { headers: { Authorization: `Bearer ${TOKEN()}` } });
  if (!r.ok) return [];
  const data: { result: { name: string }[] } = await r.json();
  const records = await Promise.all(data.result.map(k => kvGet(k.name).then(v => v ? JSON.parse(v) as AccountRecord : null)));
  return records.filter(Boolean) as AccountRecord[];
}
