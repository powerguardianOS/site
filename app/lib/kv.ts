// Workers KV over the Cloudflare REST API. Every call checks the result and
// throws on failure: callers must fail closed (a write that did not happen
// must never be reported as done, e.g. a sign-in link nobody can redeem).
export const runtime = 'edge';

// CLOUDFLARE_API_BASE is for local testing only (a fake KV on 127.0.0.1); production leaves it unset.
const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `${process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4'}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

export async function kvGet(key: string): Promise<string | null> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`KV read failed (${r.status})`);
  return r.text();
}

export async function kvPut(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const q = ttlSeconds ? `?expiration_ttl=${Math.max(60, Math.floor(ttlSeconds))}` : '';
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}${q}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
    body: value,
  });
  if (!r.ok) throw new Error(`KV write failed (${r.status})`);
}

export async function kvDel(key: string): Promise<void> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (!r.ok && r.status !== 404) throw new Error(`KV delete failed (${r.status})`);
}
