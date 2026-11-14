#!/usr/bin/env node
// EU-1 backfill: copies every Workers KV key (value + expiration) into the EU D1 table, idempotently.
// Run it while the site runs with KV_BACKEND=dual (every new write already goes to both), see EU-1-RUNBOOK.md.
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_KV_NAMESPACE_ID=… D1_DATABASE_ID=… node scripts/eu-backfill.mjs [flags]
//   --dry-run      read only: list KV and D1 keys, report per prefix what would be copied (no value reads, no writes)
//   --overwrite    also replace a D1 row whose value or expiry differs from KV (default: an existing D1 row is kept,
//                  because in dual mode D1 is never older than KV)
//   --prefix=P     only keys starting with P
//   --rps=N        API requests per second (default 3; the API allows 4/s per user and the live site shares it)
// Prints counts per key prefix only: never values, tokens or key names.
import { config, flags, client, table, bump, sha } from './eu-lib.mjs';

const f = flags();
const cfg = config();
const api = client(cfg, f.rps);
const prefix = typeof f.prefix === 'string' ? f.prefix : '';
const MAX_VALUE = 1_900_000; // D1: a row is at most 2 MB
const now = () => Math.floor(Date.now() / 1000);
const counts = {};
const log = (s) => process.stderr.write(s + '\n');

log(`EU-1 backfill${f['dry-run'] ? ' (dry run)' : ''}: listing KV and D1 keys…`);
const kvKeys = await api.kvKeys(prefix);
const d1Rows = await api.d1Rows(!!f.overwrite, prefix);
const inD1 = new Map(d1Rows.map((r) => [r.name, r]));
for (const k of kvKeys) bump(counts, k.name, 'kv');
for (const r of d1Rows) bump(counts, r.name, 'd1_before');

const todo = [];
for (const k of kvKeys) {
  if (k.expiration && k.expiration <= now() + 5) { bump(counts, k.name, 'expired'); continue; }
  if (inD1.has(k.name) && !f.overwrite) { bump(counts, k.name, 'already'); continue; }
  todo.push(k);
}

if (f['dry-run']) {
  for (const k of todo) bump(counts, k.name, inD1.has(k.name) ? 'would_check' : 'would_copy');
  console.log(table(counts, ['kv', 'd1_before', 'already', 'expired', 'would_copy', 'would_check']));
  console.log(`\ndry run: nothing written. ${api.requests} API requests.`);
  process.exit(0);
}

const inserted = [];
let batch = [];
let done = 0;
async function flush() {
  if (!batch.length) return;
  const res = await api.d1Batch(batch.map((b) => b.stmt));
  res.forEach((r, i) => {
    const b = batch[i];
    const changed = (r.meta?.changes ?? 0) > 0;
    bump(counts, b.name, b.overwrite ? (changed ? 'replaced' : 'same') : (changed ? 'copied' : 'already'));
    if (changed) inserted.push({ name: b.name, hash: b.hash });
  });
  batch = [];
}

for (const k of todo) {
  const value = await api.kvValue(k.name);
  if (++done % 100 === 0) log(`  ${done}/${todo.length}`);
  if (value === null) { bump(counts, k.name, 'vanished'); continue; }
  if (Buffer.byteLength(value) > MAX_VALUE) { bump(counts, k.name, 'too_large'); continue; }
  const existing = inD1.get(k.name);
  const exp = k.expiration ? 'CAST(?3 AS INTEGER)' : 'NULL';
  const params = k.expiration ? [k.name, value, String(k.expiration)] : [k.name, value];
  if (existing) { // --overwrite: only when something differs
    if (existing.value === value && existing.expiration === (k.expiration || 0)) { bump(counts, k.name, 'same'); continue; }
    batch.push({ name: k.name, hash: sha(value), overwrite: true, stmt: { sql: `INSERT INTO kv (key, value, expires_at) VALUES (?1, ?2, ${exp}) ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`, params } });
  } else {
    batch.push({ name: k.name, hash: sha(value), overwrite: false, stmt: { sql: `INSERT INTO kv (key, value, expires_at) VALUES (?1, ?2, ${exp}) ON CONFLICT (key) DO NOTHING`, params } });
  }
  if (batch.length >= 25) await flush();
}
await flush();

// A key deleted in dual mode between our KV read and our insert would come back to life in D1: list KV again and
// remove such rows, but only when D1 still holds exactly the value we copied (never a newer write).
if (inserted.length) {
  const still = new Set((await api.kvKeys(prefix)).map((k) => k.name));
  for (const ins of inserted) {
    if (still.has(ins.name)) continue;
    const row = (await api.d1Query('SELECT value FROM kv WHERE key = ?1', [ins.name])).results?.[0];
    if (row && sha(String(row.value)) === ins.hash) { await api.d1Query('DELETE FROM kv WHERE key = ?1', [ins.name]); bump(counts, ins.name, 'undone_race'); }
  }
}

console.log(table(counts, ['kv', 'd1_before', 'copied', 'already', 'replaced', 'same', 'expired', 'vanished', 'too_large', 'undone_race']));
const bad = Object.values(counts).reduce((s, x) => s + (x.too_large || 0), 0);
console.log(`\n${api.requests} API requests.${bad ? ` ${bad} value(s) too large for D1: NOT copied, see the runbook.` : ''} Next: node scripts/eu-verify.mjs`);
process.exit(bad ? 1 : 0);
