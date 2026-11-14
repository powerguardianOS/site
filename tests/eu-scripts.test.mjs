// EU-1: scripts/eu-backfill.mjs and scripts/eu-verify.mjs against a loopback fake of the Cloudflare API (Workers KV
// with list cursors and expirations, D1 = real SQLite with the real schema). Run: node tests/eu-scripts.test.mjs
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFakeD1, D1_PATH } from './fake-d1.mjs';

const kv = new Map(), kvExp = new Map();
const d1 = createFakeD1();
let pageSize = 3; // small pages so the list cursor is exercised
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let body = ''; for await (const c of req) body += c;
  if (req.headers.authorization !== 'Bearer test-token') { res.writeHead(403).end(); return; }
  if (D1_PATH.test(u.pathname)) { const r = d1.handle(JSON.parse(body)); res.writeHead(r.status, { 'content-type': 'application/json' }).end(JSON.stringify(r.json)); return; }
  if (u.pathname.endsWith('/keys')) {
    const p = u.searchParams.get('prefix') ?? ''; const start = Number(u.searchParams.get('cursor') || 0);
    const all = [...kv.keys()].filter((k) => k.startsWith(p)).sort();
    const page = all.slice(start, start + pageSize);
    const cursor = start + pageSize < all.length ? String(start + pageSize) : '';
    res.writeHead(200).end(JSON.stringify({ result: page.map((name) => (kvExp.has(name) ? { name, expiration: kvExp.get(name) } : { name })), result_info: { count: page.length, cursor } }));
    return;
  }
  const m = u.pathname.match(/\/values\/(.+)$/); if (!m) { res.writeHead(404).end(); return; }
  const k = decodeURIComponent(m[1]);
  if (req.method === 'GET') { if (kv.has(k)) res.writeHead(200).end(kv.get(k)); else res.writeHead(404).end(); return; }
  res.writeHead(405).end();
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

const run = (script, args = []) => new Promise((resolve) => {
  execFile(process.execPath, [fileURLToPath(new URL('../scripts/' + script, import.meta.url)), '--rps=1000', ...args], {
    env: { ...process.env, CLOUDFLARE_API_BASE: `http://127.0.0.1:${port}`, CLOUDFLARE_API_TOKEN: 'test-token', CLOUDFLARE_KV_NAMESPACE_ID: 'ns', D1_DATABASE_ID: 'db', NODE_NO_WARNINGS: '1' },
  }, (err, stdout, stderr) => resolve({ code: err ? err.code : 0, out: stdout + stderr }));
});

let passed = 0, failed = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok || !extra ? '' : '\n' + extra}`); ok ? passed++ : failed++; };
const now = Math.floor(Date.now() / 1000);
const SECRET = 'SECRETVALUE';
const emailKey = 'account:jane.doe@example.com';
kv.set(emailKey, `{"email":"jane","s":"${SECRET}1"}`);
kv.set('license:lic-1', `{"id":"lic-1","token":"${SECRET}2"}`);
kv.set('index:token:abcdef0123', 'lic-1');
kv.set('index:all', '["lic-1"]');
kv.set('session:s1', `${SECRET}3`); kvExp.set('session:s1', now + 3600);
kv.set('magic:gone', 'x'); kvExp.set('magic:gone', now - 10);       // already expired: never copied
kv.set('audit:1', 'a'); kv.set('audit:2', 'b'); kv.set('audit:3', 'c');
d1.kv.set('license:lic-1', `{"id":"lic-1","token":"${SECRET}2"}`); // already copied (e.g. by a dual write)

console.log('backfill --dry-run');
let r = await run('eu-backfill.mjs', ['--dry-run']);
check('dry run exits 0', r.code === 0, r.out);
check('dry run writes nothing', d1.kv.size === 1);
check('dry run reports would_copy per prefix', /TOTAL\s+9\s+1\s+1\s+1\s+7/.test(r.out), r.out);

console.log('\nbackfill');
r = await run('eu-backfill.mjs');
check('exits 0', r.code === 0, r.out);
check('copies every live key, keeps the existing one', d1.kv.size === 8 && !d1.kv.has('magic:gone'));
check('values identical', [...kv.keys()].filter((k) => k !== 'magic:gone').every((k) => d1.kv.get(k) === kv.get(k)));
check('expiration carried over', d1.kv.expiresAt('session:s1') === now + 3600 && d1.kv.expiresAt('index:all') === null);
check('output never shows values', !r.out.includes(SECRET));
check('output never shows key names (only prefixes)', !r.out.includes('jane') && !r.out.includes('abcdef0123') && !r.out.includes('lic-1'), r.out);
check('counts per prefix', /index:token\s+1/.test(r.out) && /audit\s+3/.test(r.out), r.out);

console.log('\nidempotent');
r = await run('eu-backfill.mjs');
check('second run copies nothing', r.code === 0 && /TOTAL\s+9\s+8\s+0\s+8/.test(r.out), r.out);

console.log('\nverify');
r = await run('eu-verify.mjs');
check('identical -> exit 0', r.code === 0 && r.out.includes('OK:'), r.out);
r = await run('eu-verify.mjs', ['--counts-only']);
check('counts-only -> exit 0', r.code === 0, r.out);

d1.db.prepare("UPDATE kv SET value = 'tampered' WHERE key = 'audit:2'").run();
d1.kv.delete('index:all');
d1.kv.set('share:extra', 'x');
d1.db.prepare('UPDATE kv SET expires_at = NULL WHERE key = ?').run('session:s1');
r = await run('eu-verify.mjs');
check('differences -> exit 1', r.code === 1, r.out);
check('value, missing, extra and expiry differences all found', ['value_differs', 'missing_in_d1', 'extra_in_d1', 'expiry_differs'].every((w) => r.out.includes(w + ' ')), r.out);
check('verify output never shows values or key names', !r.out.includes(SECRET) && !r.out.includes('tampered') && !r.out.includes('jane') && !r.out.includes('share:extra'), r.out);

console.log('\nbackfill --overwrite repairs');
r = await run('eu-backfill.mjs', ['--overwrite']);
check('exits 0', r.code === 0, r.out);
check('value and expiry repaired, missing copied', d1.kv.get('audit:2') === 'b' && d1.kv.has('index:all') && d1.kv.expiresAt('session:s1') === now + 3600);
d1.kv.delete('share:extra');
r = await run('eu-verify.mjs');
check('verify clean again', r.code === 0, r.out);

console.log('\nguards');
r = await new Promise((resolve) => execFile(process.execPath, [fileURLToPath(new URL('../scripts/eu-verify.mjs', import.meta.url))], { env: { PATH: process.env.PATH } }, (e, o, s) => resolve({ code: e ? e.code : 0, out: o + s })));
check('missing env -> exit 2, names the variables only', r.code === 2 && r.out.includes('CLOUDFLARE_API_TOKEN'), r.out);

srv.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
