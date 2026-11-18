// The site's key-value store. Every call checks the result and throws on failure: callers must fail closed (a write
// that did not happen must never be reported as done, e.g. a sign-in link nobody can redeem).
//
// EU-1: the data moves from Workers KV (global) to a D1 database created in the EU jurisdiction, both over the
// Cloudflare REST API (the same way KV has always been reached from the edge runtime; no Pages binding). KV_BACKEND:
//   kv   (default) Workers KV only, as before.
//   dual           write both (D1 first, both must succeed), deletes to both; reads and lists from KV only. KV stays the
//                  one truth while D1 is filled (writes + scripts/eu-backfill.mjs) and checked (scripts/eu-verify.mjs).
//                  D1 is never read here, so nothing deleted can come back from a stale copy (review 2026-11-15).
//   d1             D1 only. KV is never called.
// Any other value throws: no silent fallback to a global store.
// D1 table (db/eu-1-kv.sql): kv(key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER) — expires_at in unix
// seconds like KV's expiration, NULL = never. Expired rows are invisible at once (lazy expiry) and removed by
// d1Cleanup, which a write runs now and then.
export const runtime = 'edge';

// Test hook: an override is honoured ONLY when it points at 127.0.0.1/localhost, so a
// mis-set variable can never send CLOUDFLARE_API_TOKEN / BREVO_API_KEY to another host.
export function localOnlyBase(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const u = new URL(value);
    if ((u.protocol === 'http:' || u.protocol === 'https:') && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) return value.replace(/\/$/, '');
  } catch { /* fall through */ }
  return fallback;
}
export const cfApiBase = () => localOnlyBase(process.env.CLOUDFLARE_API_BASE, 'https://api.cloudflare.com/client/v4');

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `${cfApiBase()}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

export type KvBackend = 'kv' | 'dual' | 'd1';
export function kvBackend(): KvBackend {
  const b = (process.env.KV_BACKEND ?? '').trim() || 'kv';
  if (b === 'kv' || b === 'dual' || b === 'd1') return b;
  throw new Error('KV_BACKEND must be kv, dual or d1');
}
// KV's minimum TTL is 60 s; D1 uses the same rule so both stores expire a key at the same moment.
const ttlOf = (ttlSeconds?: number) => (ttlSeconds ? Math.max(60, Math.floor(ttlSeconds)) : 0);
const nowS = () => Math.floor(Date.now() / 1000);

// ------------------------------------------------------------------ Workers KV

async function wkvGet(key: string): Promise<string | null> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`KV read failed (${r.status})`);
  return r.text();
}

async function wkvPut(key: string, value: string, ttl: number): Promise<void> {
  const q = ttl ? `?expiration_ttl=${ttl}` : '';
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}${q}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
    body: value,
  });
  if (!r.ok) throw new Error(`KV write failed (${r.status})`);
}

async function wkvDel(key: string): Promise<void> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (!r.ok && r.status !== 404) throw new Error(`KV delete failed (${r.status})`);
}

type KvKey = { name: string; expiration?: number };
async function wkvList(prefix: string, limit: number): Promise<KvKey[]> {
  const r = await fetch(`${BASE()}/keys?prefix=${encodeURIComponent(prefix)}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (!r.ok) throw new Error(`KV list failed (${r.status})`);
  const data = (await r.json()) as { result: KvKey[] };
  return data.result;
}

// ------------------------------------------------------------------------- D1

const D1_DB = () => process.env.D1_DATABASE_ID;
type D1Result = { results?: Record<string, unknown>[]; success?: boolean; meta?: { changes?: number } };

// One statement over POST /accounts/{id}/d1/database/{db}/query. Parameters are sent as strings (the API's type);
// numeric columns CAST them. Throws on any failure, never includes values in the message.
export async function d1Query(sql: string, params: string[] = []): Promise<D1Result> {
  const db = D1_DB();
  if (!db) throw new Error('D1 not configured (D1_DATABASE_ID)');
  const r = await fetch(`${cfApiBase()}/accounts/${ACCOUNT_ID}/d1/database/${db}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  if (!r.ok) throw new Error(`D1 query failed (${r.status})`);
  const data = (await r.json().catch(() => null)) as { success?: boolean; result?: D1Result[] } | null;
  const res = data?.result?.[0];
  if (!data?.success || !res || res.success === false) throw new Error('D1 query failed (error result)');
  return res;
}

const LIVE = '(expires_at IS NULL OR expires_at > CAST(?2 AS INTEGER))';

async function d1Get(key: string): Promise<string | null> {
  const res = await d1Query(`SELECT value FROM kv WHERE key = ?1 AND ${LIVE}`, [key, String(nowS())]);
  const row = res.results?.[0];
  return row ? String(row.value) : null;
}

// expiresAt: unix seconds or 0 (never).
async function d1Put(key: string, value: string, expiresAt: number): Promise<void> {
  const exp = expiresAt ? 'CAST(?3 AS INTEGER)' : 'NULL';
  const params = expiresAt ? [key, value, String(expiresAt)] : [key, value];
  await d1Query(`INSERT INTO kv (key, value, expires_at) VALUES (?1, ?2, ${exp}) ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`, params);
  if (Math.random() < 0.02) await d1Cleanup().catch(() => {}); // housekeeping never fails a write
}

async function d1Del(key: string): Promise<void> {
  await d1Query('DELETE FROM kv WHERE key = ?1', [key]);
}

async function d1List(prefix: string, limit: number): Promise<string[]> {
  const res = await d1Query(
    `SELECT key FROM kv WHERE key >= ?1 AND substr(key, 1, length(?1)) = ?1 AND ${LIVE} ORDER BY key LIMIT CAST(?3 AS INTEGER)`,
    [prefix, String(nowS()), String(limit)],
  );
  return (res.results ?? []).map((r) => String(r.key));
}

// Removes up to 500 expired rows. Run by writes (2 %); also safe to call from a script or a cron.
export async function d1Cleanup(): Promise<number> {
  const res = await d1Query(
    'DELETE FROM kv WHERE key IN (SELECT key FROM kv WHERE expires_at IS NOT NULL AND expires_at <= CAST(?1 AS INTEGER) LIMIT 500)',
    [String(nowS())],
  );
  return res.meta?.changes ?? 0;
}

// ------------------------------------------------------------------ public API

export async function kvGet(key: string): Promise<string | null> {
  const b = kvBackend();
  return b === 'd1' ? d1Get(key) : wkvGet(key); // dual reads KV, the one truth until the switch to d1
}

export async function kvPut(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const b = kvBackend();
  const ttl = ttlOf(ttlSeconds);
  if (b !== 'kv') await d1Put(key, value, ttl ? nowS() + ttl : 0);
  if (b !== 'd1') await wkvPut(key, value, ttl);
}

export async function kvDel(key: string): Promise<void> {
  const b = kvBackend();
  if (b !== 'kv') await d1Del(key);
  if (b !== 'd1') await wkvDel(key);
}

// Key names with this prefix, sorted (as KV lists them), at most `limit` (one page, as the callers have always used).
export async function kvList(prefix: string, limit = 1000): Promise<string[]> {
  const b = kvBackend();
  if (b === 'd1') return d1List(prefix, limit);
  return (await wkvList(prefix, limit)).map((k) => k.name); // dual lists KV, like it reads it
}

// Values of many keys in one go (missing or expired keys are left out). D1: one query; KV (and dual, which reads KV):
// one read per key, as KV's REST API has no multi-get.
export async function kvGetMany(keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!keys.length) return out;
  if (kvBackend() === 'd1') {
    const res = await d1Query(`SELECT key, value FROM kv WHERE key IN (SELECT value FROM json_each(?1)) AND ${LIVE}`, [JSON.stringify(keys), String(nowS())]);
    for (const r of res.results ?? []) out.set(String(r.key), String(r.value));
    return out;
  }
  const vals = await Promise.all(keys.map((k) => wkvGet(k)));
  keys.forEach((k, i) => { if (vals[i] !== null) out.set(k, vals[i]!); });
  return out;
}

// Keys and values under a prefix, sorted by key, at most `max`. truncated: more exist than were returned. D1: one query;
// KV: one key listing (a KV page holds at most 1000 keys, so max is capped there and reported as truncated) and one
// read per key.
export async function kvListValues(prefix: string, max: number): Promise<{ entries: [string, string][]; truncated: boolean }> {
  if (kvBackend() === 'd1') {
    const res = await d1Query(
      `SELECT key, value FROM kv WHERE key >= ?1 AND substr(key, 1, length(?1)) = ?1 AND ${LIVE} ORDER BY key LIMIT CAST(?3 AS INTEGER)`,
      [prefix, String(nowS()), String(max + 1)],
    );
    const rows = (res.results ?? []).map((r) => [String(r.key), String(r.value)] as [string, string]);
    return { entries: rows.slice(0, max), truncated: rows.length > max };
  }
  const page = Math.min(max + 1, 1000);
  const names = (await wkvList(prefix, page)).map((k) => k.name);
  const keys = names.slice(0, Math.min(max, page));
  const vals = await kvGetMany(keys);
  return { entries: keys.filter((k) => vals.has(k)).map((k) => [k, vals.get(k)!]), truncated: names.length > keys.length || (names.length === 1000 && max >= 1000) };
}

