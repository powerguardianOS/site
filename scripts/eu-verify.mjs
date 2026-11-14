#!/usr/bin/env node
// EU-1 verify: compares Workers KV with the EU D1 table key by key — presence, SHA-256 of the value, expiry.
// Run after scripts/eu-backfill.mjs while KV_BACKEND=dual. Exit 0 = identical, 1 = differences (listed by prefix and
// a short hash of the key name; never values, tokens or key names).
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_KV_NAMESPACE_ID=… D1_DATABASE_ID=… node scripts/eu-verify.mjs [--prefix=P] [--rps=N]
//   --counts-only  compare key counts per prefix only (no value reads: 1 request per 1000 keys)
import { config, flags, client, table, bump, sha, keyTag } from './eu-lib.mjs';

const f = flags();
const cfg = config();
const api = client(cfg, f.rps);
const prefix = typeof f.prefix === 'string' ? f.prefix : '';
const SKEW = 120; // KV and D1 compute "now + ttl" on different clocks in dual mode
const now = () => Math.floor(Date.now() / 1000);
const counts = {};
const diffs = [];
const log = (s) => process.stderr.write(s + '\n');

log('EU-1 verify: listing KV keys and D1 rows…');
const kvKeys = (await api.kvKeys(prefix)).filter((k) => !k.expiration || k.expiration > now() + 5);
const d1Rows = await api.d1Rows(!f['counts-only'], prefix);
const d1 = new Map(d1Rows.map((r) => [r.name, r]));
const kvNames = new Set(kvKeys.map((k) => k.name));
for (const k of kvKeys) bump(counts, k.name, 'kv');
for (const r of d1Rows) bump(counts, r.name, 'd1');

const diff = (name, what) => { bump(counts, name, what); diffs.push(`${what.padEnd(15)} ${keyTag(name)}`); };
for (const k of kvKeys) if (!d1.has(k.name)) diff(k.name, 'missing_in_d1');
for (const r of d1Rows) if (!kvNames.has(r.name) && !(r.expiration && r.expiration <= now() + SKEW)) diff(r.name, 'extra_in_d1');

if (!f['counts-only']) {
  let n = 0;
  const both = kvKeys.filter((k) => d1.has(k.name));
  for (const k of both) {
    if (++n % 100 === 0) log(`  ${n}/${both.length}`);
    const v = await api.kvValue(k.name);
    if (v === null) continue; // deleted or expired while we ran
    const row = d1.get(k.name);
    if (sha(v) !== sha(row.value)) { diff(k.name, 'value_differs'); continue; }
    const a = k.expiration || 0, b = row.expiration || 0;
    if ((a === 0) !== (b === 0) || Math.abs(a - b) > SKEW) { diff(k.name, 'expiry_differs'); continue; }
    bump(counts, k.name, 'same');
  }
}

const cols = f['counts-only'] ? ['kv', 'd1', 'missing_in_d1', 'extra_in_d1'] : ['kv', 'd1', 'same', 'missing_in_d1', 'extra_in_d1', 'value_differs', 'expiry_differs'];
console.log(table(counts, cols));
if (diffs.length) {
  console.log(`\n${diffs.length} difference(s)${diffs.length > 30 ? ' (first 30)' : ''}:`);
  for (const d of diffs.slice(0, 30)) console.log('  ' + d);
  console.log('\nRe-run the backfill (add --overwrite for value/expiry differences), then verify again.');
} else console.log('\nOK: KV and D1 hold the same keys' + (f['counts-only'] ? ' (counts only)' : ', values and expiries') + '.');
console.log(`${api.requests} API requests.`);
process.exit(diffs.length ? 1 : 0);
