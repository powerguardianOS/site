// EU-1 test double for D1 over the REST API: a real SQLite database in memory (node:sqlite) with the real schema
// (db/eu-1-kv.sql), so the SQL in app/lib/kv.ts and the scripts runs for real. Shared by tests/harness.mts,
// scripts/cloud-dev.mjs, scripts/cloud-chain.mjs and tests/eu-scripts.test.mjs.
//   const d1 = createFakeD1();  d1.handle(jsonBody) -> the API's JSON answer;  d1.kv -> a Map-like view (raw rows,
//   ignores expiry, like the KV fakes' Map) for tests that seed or inspect the store directly.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const SCHEMA = readFileSync(new URL('../db/eu-1-kv.sql', import.meta.url), 'utf8');

export function createFakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const one = ({ sql, params = [] }) => {
    if (params.some((p) => typeof p !== 'string')) throw new Error('D1 REST params must be strings');
    if (/^\s*(SELECT|WITH)\b/i.test(sql)) return { results: db.prepare(sql).all(...params), success: true, meta: { changes: 0 } };
    if (!params.length && /;\s*\S/.test(sql)) { db.exec(sql); return { results: [], success: true, meta: { changes: 0 } }; }
    const r = db.prepare(sql).run(...params);
    return { results: [], success: true, meta: { changes: Number(r.changes) } };
  };
  const handle = (body) => {
    try {
      const result = body.batch ? body.batch.map(one) : [one(body)];
      return { status: 200, json: { success: true, errors: [], messages: [], result } };
    } catch (e) {
      return { status: 400, json: { success: false, errors: [{ code: 7500, message: String(e.message) }], messages: [], result: [] } };
    }
  };
  const kv = {
    get: (k) => db.prepare('SELECT value FROM kv WHERE key = ?').get(k)?.value,
    has: (k) => !!db.prepare('SELECT 1 FROM kv WHERE key = ?').get(k),
    set(k, v) { db.prepare('INSERT INTO kv (key, value, expires_at) VALUES (?, ?, NULL) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(k, String(v)); return this; },
    delete: (k) => db.prepare('DELETE FROM kv WHERE key = ?').run(k).changes > 0,
    clear: () => { db.exec('DELETE FROM kv'); },
    keys: () => db.prepare('SELECT key FROM kv ORDER BY key').all().map((r) => r.key)[Symbol.iterator](),
    values: () => db.prepare('SELECT value FROM kv ORDER BY key').all().map((r) => r.value)[Symbol.iterator](),
    entries: () => db.prepare('SELECT key, value FROM kv ORDER BY key').all().map((r) => [r.key, r.value])[Symbol.iterator](),
    get size() { return Number(db.prepare('SELECT count(*) n FROM kv').get().n); },
    [Symbol.iterator]() { return this.entries(); },
    expiresAt: (k) => db.prepare('SELECT expires_at FROM kv WHERE key = ?').get(k)?.expires_at ?? null,
  };
  return { db, handle, kv };
}

// The D1 query route of the Cloudflare API, for the fake HTTP servers.
export const D1_PATH = /\/accounts\/[^/]+\/d1\/database\/[^/]+\/query$/;

// The store a test seeds and inspects for KV_BACKEND: the KV Map (kv), the D1 table (d1), or both (dual: a direct
// set/delete goes to both stores, as the app's own writes do; reads see D1).
export function storeFor(backend, kvMap, d1, kvExp = new Map()) {
  if (backend === 'kv') return kvMap;
  if (backend === 'd1') return d1.kv;
  if (backend !== 'dual') throw new Error('KV_BACKEND must be kv, dual or d1');
  const both = Object.assign(Object.create(d1.kv), {
    set(k, v) { d1.kv.set(k, v); kvMap.set(k, v); kvExp.delete(k); return both; },
    delete(k) { kvMap.delete(k); kvExp.delete(k); return d1.kv.delete(k); },
    clear() { d1.kv.clear(); kvMap.clear(); kvExp.clear(); },
  });
  return both;
}

// Workers KV + D1 routes of the Cloudflare API for the loopback fake servers (scripts/cloud-dev.mjs,
// scripts/cloud-chain.mjs). Returns true when it answered.
export function cfRoutes({ kvMap, kvExp = new Map(), d1 }) {
  return (u, req, body, res) => {
    if (D1_PATH.test(u.pathname)) { const r = d1.handle(JSON.parse(body)); res.writeHead(r.status, { 'content-type': 'application/json' }).end(JSON.stringify(r.json)); return true; }
    if (u.pathname.endsWith('/keys')) { const p = u.searchParams.get('prefix') ?? ''; res.writeHead(200).end(JSON.stringify({ result: [...kvMap.keys()].filter((k) => k.startsWith(p)).sort().map((name) => (kvExp.has(name) ? { name, expiration: kvExp.get(name) } : { name })) })); return true; }
    const m = u.pathname.match(/\/values\/(.+)$/); if (!m) return false;
    const k = decodeURIComponent(m[1]);
    if (req.method === 'PUT') { kvMap.set(k, body); const ttl = Number(u.searchParams.get('expiration_ttl') || 0); if (ttl) kvExp.set(k, Math.floor(Date.now() / 1000) + ttl); else kvExp.delete(k); res.writeHead(200).end('{}'); }
    else if (req.method === 'DELETE') { kvMap.delete(k); kvExp.delete(k); res.writeHead(200).end('{}'); }
    else if (kvMap.has(k)) res.writeHead(200).end(kvMap.get(k)); else res.writeHead(404).end();
    return true;
  };
}
