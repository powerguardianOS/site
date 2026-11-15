// EU-1 shared helpers for scripts/eu-backfill.mjs and scripts/eu-verify.mjs: Workers KV and D1 over the Cloudflare
// REST API, throttled (the API allows 1200 requests / 5 min per user; the site shares that budget) with retries.
// Never prints values, tokens or full key names: reports use the key's prefix and a short hash of the name.
import { createHash } from 'node:crypto';

export function config() {
  const env = process.env;
  const need = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_KV_NAMESPACE_ID', 'D1_DATABASE_ID'].filter((k) => !env[k]);
  if (need.length) { console.error('missing env: ' + need.join(', ')); process.exit(2); }
  let base = 'https://api.cloudflare.com/client/v4';
  if (env.CLOUDFLARE_API_BASE) { // test hook, honoured only for loopback (as app/lib/kv.ts)
    try { const u = new URL(env.CLOUDFLARE_API_BASE); if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') base = env.CLOUDFLARE_API_BASE.replace(/\/$/, ''); } catch { /* real API */ }
  }
  const account = env.CLOUDFLARE_ACCOUNT_ID || '5f4b3228b678331dd09cf6bfe8514857';
  return { base, account, token: env.CLOUDFLARE_API_TOKEN, ns: env.CLOUDFLARE_KV_NAMESPACE_ID, db: env.D1_DATABASE_ID };
}

export function flags(argv = process.argv.slice(2)) {
  const f = {};
  for (const a of argv) { const m = a.match(/^--([a-z-]+)(?:=(.*))?$/); if (m) f[m[1]] = m[2] ?? true; else { console.error('unknown argument'); process.exit(2); } }
  return f;
}

export function client(cfg, rps = 1) {
  const gap = 1000 / Math.max(0.1, Number(rps) || 1);
  let next = 0, requests = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function call(path, init = {}, okStatuses = []) {
    for (let attempt = 0; ; attempt++) {
      const wait = next - Date.now(); next = Math.max(Date.now(), next) + gap; if (wait > 0) await sleep(wait);
      requests++;
      let r;
      try { r = await fetch(cfg.base + path, { ...init, headers: { Authorization: `Bearer ${cfg.token}`, ...(init.headers || {}) } }); } catch { r = null; }
      if (r && (r.ok || okStatuses.includes(r.status))) return r;
      const status = r ? r.status : 'network';
      if (attempt >= 5 || (r && r.status < 500 && r.status !== 429)) throw new Error(`API ${init.method || 'GET'} ${path.split('/').slice(0, 7).join('/')}… failed (${status})`);
      await sleep(Math.min(30000, 1000 * 2 ** attempt));
    }
  }
  const kvBase = `/accounts/${cfg.account}/storage/kv/namespaces/${cfg.ns}`;
  const d1Path = `/accounts/${cfg.account}/d1/database/${cfg.db}/query`;
  async function d1(body) {
    const r = await call(d1Path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.success || (j.result || []).some((x) => x.success === false)) throw new Error('D1 query failed (error result)');
    return j.result;
  }
  return {
    get requests() { return requests; },
    // every KV key with its expiration (unix s) or 0, following the list cursor
    async kvKeys(prefix = '') {
      const out = []; let cursor = '';
      do {
        const q = new URLSearchParams({ limit: '1000', ...(prefix ? { prefix } : {}), ...(cursor ? { cursor } : {}) });
        const j = await (await call(`${kvBase}/keys?${q}`)).json();
        for (const k of j.result) out.push({ name: k.name, expiration: k.expiration || 0 });
        cursor = j.result_info?.cursor || '';
      } while (cursor);
      return out;
    },
    async kvValue(name) {
      const r = await call(`${kvBase}/values/${encodeURIComponent(name)}`, {}, [404]);
      return r.status === 404 ? null : r.text();
    },
    d1Query: (sql, params = []) => d1({ sql, params }).then((r) => r[0]),
    d1Batch: (statements) => d1({ batch: statements }),
    // every live D1 row (key, expires_at, and the value when withValues), paged by key
    async d1Rows(withValues = false, prefix = '') {
      const out = []; let after = prefix ? prefix : '';
      const now = String(Math.floor(Date.now() / 1000));
      for (;;) {
        const cols = withValues ? 'key, value, expires_at' : 'key, expires_at';
        const res = await d1({ sql: `SELECT ${cols} FROM kv WHERE key > ?1 AND substr(key, 1, length(?2)) = ?2 AND (expires_at IS NULL OR expires_at > CAST(?3 AS INTEGER)) ORDER BY key LIMIT 200`, params: [after, prefix, now] });
        const rows = res[0].results || [];
        out.push(...rows.map((r) => ({ name: String(r.key), expiration: Number(r.expires_at || 0), value: withValues ? String(r.value) : undefined })));
        if (rows.length < 200) break;
        after = String(rows.at(-1).key);
      }
      // `key > ''` skips a key that is exactly the prefix; fetch it on its own
      if (prefix) {
        const res = await d1({ sql: `SELECT ${withValues ? 'key, value, expires_at' : 'key, expires_at'} FROM kv WHERE key = ?1 AND (expires_at IS NULL OR expires_at > CAST(?2 AS INTEGER))`, params: [prefix, now] });
        for (const r of res[0].results || []) out.unshift({ name: String(r.key), expiration: Number(r.expires_at || 0), value: withValues ? String(r.value) : undefined });
      }
      return out;
    },
  };
}

// "license", "index:token", "audit", … — the part of a key name that says what it is, never the identifying part
export function prefixOf(name) {
  const parts = name.split(':');
  if (parts.length < 2) return '(none)';
  return parts[0] === 'index' || parts[0] === 'rl' || parts[0] === 'reconfirm' ? parts.slice(0, 2).join(':') : parts[0];
}
export const keyTag = (name) => prefixOf(name) + '#' + createHash('sha256').update(name).digest('hex').slice(0, 12);
export const sha = (v) => createHash('sha256').update(v).digest('hex');

export function table(counts, cols) {
  const rows = Object.keys(counts).sort().map((p) => [p, ...cols.map((c) => String(counts[p][c] || 0))]);
  const tot = ['TOTAL', ...cols.map((c) => String(Object.values(counts).reduce((s, x) => s + (x[c] || 0), 0)))];
  const all = [['prefix', ...cols], ...rows, tot];
  const w = all[0].map((_, i) => Math.max(...all.map((r) => r[i].length)));
  return all.map((r) => r.map((c, i) => (i ? c.padStart(w[i]) : c.padEnd(w[i]))).join('  ')).join('\n');
}
export const bump = (counts, name, col, n = 1) => { const p = prefixOf(name); (counts[p] ||= {})[col] = (counts[p][col] || 0) + n; };
