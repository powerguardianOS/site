export const runtime = 'edge';

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

async function kvGet(key: string): Promise<string | null> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (r.status === 404) return null;
  return r.text();
}

async function kvPut(key: string, value: string): Promise<void> {
  await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
    body: value,
  });
}

async function kvDel(key: string): Promise<void> {
  await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(email: string): Promise<string> {
  const token = randomHex(32);
  const expires = Date.now() + 86400000;
  await kvPut(`session:${token}`, JSON.stringify({ email, expires }));
  return token;
}

export async function getSession(id: string): Promise<string | null> {
  const raw = await kvGet(`session:${id}`);
  if (!raw) return null;
  try {
    const { email, expires } = JSON.parse(raw);
    if (expires < Date.now()) return null;
    return email;
  } catch {
    return null;
  }
}

export async function deleteSession(id: string): Promise<void> {
  await kvDel(`session:${id}`);
}
