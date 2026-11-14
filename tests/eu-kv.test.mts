// EU-1: app/lib/kv.ts on D1 (EU jurisdiction) — TTL, lazy expiry, cleanup, prefix lists, the dual mode used for the
// zero-downtime move, and fail-closed behaviour. Run: npx tsx tests/eu-kv.test.mts (switches KV_BACKEND itself).
import { kvMap, kvExp, d1, calls, check, done } from './harness.mts';

const { kvGet, kvPut, kvDel, kvList, d1Cleanup, kvBackend } = await import('../app/lib/kv.ts');
const now = () => Math.floor(Date.now() / 1000);
const exp = (k: string) => d1.kv.expiresAt(k) as number | null;
const reset = () => { d1.kv.clear(); kvMap.clear(); kvExp.clear(); calls.kv = 0; calls.d1 = 0; };
const throws = async (f: () => Promise<unknown>) => { try { await f(); return ''; } catch (e) { return String((e as Error).message); } };
const base = globalThis.fetch;
let fail: ((u: string, init: any) => Response | null) | null = null;
(globalThis as any).fetch = async (url: string, init: any = {}) => (fail && fail(String(url), init)) || base(url, init);

console.log('d1: get / put / TTL / delete');
process.env.KV_BACKEND = 'd1'; reset();
await kvPut('a:1', 'one');
check('put then get', (await kvGet('a:1')) === 'one');
check('no TTL = never expires (NULL)', exp('a:1') === null);
await kvPut('a:2', 'two', 600);
check('TTL stored as unix seconds', Math.abs((exp('a:2') ?? 0) - (now() + 600)) <= 2);
await kvPut('a:3', 'three', 5);
check('TTL below 60 s is raised to 60 s (as KV does)', Math.abs((exp('a:3') ?? 0) - (now() + 60)) <= 2);
await kvPut('a:1', 'uno', 600);
check('overwrite replaces value and expiry', (await kvGet('a:1')) === 'uno' && exp('a:1') !== null);
await kvPut('a:1', 'uno');
check('overwrite without TTL clears the expiry', exp('a:1') === null);
check('missing key -> null', (await kvGet('nope')) === null);
await kvDel('a:2');
check('delete', (await kvGet('a:2')) === null);
await kvDel('a:2');
check('delete of a missing key is fine', true);
check('d1 mode never calls Workers KV', calls.kv === 0 && calls.d1 > 0);

console.log('\nd1: lazy expiry and cleanup');
d1.db.prepare('UPDATE kv SET expires_at = ? WHERE key = ?').run(now() - 1, 'a:3');
check('an expired row is invisible at once', (await kvGet('a:3')) === null);
check('an expired row is not listed', !(await kvList('a:')).includes('a:3'));
check('cleanup removes expired rows only', (await d1Cleanup()) === 1 && !d1.kv.has('a:3') && d1.kv.has('a:1'));

console.log('\nd1: list by prefix');
reset();
for (const k of ['audit:2', 'audit:1', 'audit:3', 'auditx', 'account:b', 'a_b', 'axb', 'a%c', 'abc']) await kvPut(k, 'v');
check('sorted, prefix only', JSON.stringify(await kvList('audit:')) === '["audit:1","audit:2","audit:3"]');
check('limit', JSON.stringify(await kvList('audit:', 2)) === '["audit:1","audit:2"]');
check('_ and % in a prefix are literal, not wildcards', JSON.stringify(await kvList('a_')) === '["a_b"]' && JSON.stringify(await kvList('a%')) === '["a%c"]');
check('empty prefix lists everything', (await kvList('')).length === 9);

console.log('\ndual: write both, read D1 first, copy-on-read');
process.env.KV_BACKEND = 'dual'; reset();
await kvPut('session:x', 's', 3600);
check('a write goes to D1 and KV', d1.kv.get('session:x') === 's' && kvMap.get('session:x') === 's');
check('both with the same expiry', Math.abs((exp('session:x') ?? 0) - (kvExp.get('session:x') ?? 0)) <= 2);
kvMap.set('license:old', '{"id":"old"}');
kvMap.set('magic:t', 'm'); kvExp.set('magic:t', now() + 900);
check('a key only in KV is read from KV', (await kvGet('license:old')) === '{"id":"old"}');
check('…and copied into D1 (no expiry)', d1.kv.get('license:old') === '{"id":"old"}' && exp('license:old') === null);
await kvGet('magic:t');
check('copy-on-read keeps the KV expiration', d1.kv.get('magic:t') === 'm' && exp('magic:t') === kvExp.get('magic:t'));
d1.kv.set('k:new', 'newer'); kvMap.set('k:new', 'older');
check('D1 wins when both have the key', (await kvGet('k:new')) === 'newer');
kvMap.set('k:only', 'v1');
d1.db.prepare("INSERT INTO kv (key, value) VALUES ('k:only', 'v2')").run(); // a write raced the copy
await kvGet('k:only');
check('copy-on-read never overwrites a newer D1 row', d1.kv.get('k:only') === 'v2');
await kvDel('session:x');
check('delete removes from both', !d1.kv.has('session:x') && !kvMap.has('session:x'));
kvMap.set('list:a', '1'); d1.kv.set('list:b', '2');
check('list is the union of both', JSON.stringify(await kvList('list:')) === '["list:a","list:b"]');

console.log('\nfail closed');
reset();
fail = (u) => (u.includes('/d1/') ? new Response('boom', { status: 500 }) : null);
let msg = await throws(() => kvPut('k', 'SECRET-VALUE'));
check('dual: D1 write failure throws', msg.startsWith('D1 query failed'));
check('…before KV is written (no half write reported as done)', !kvMap.has('k'));
check('…and the error never contains the value', !msg.includes('SECRET-VALUE'));
check('dual: D1 read failure throws (no silent fall back to KV)', (await throws(() => kvGet('k'))).startsWith('D1'));
process.env.KV_BACKEND = 'd1';
check('d1: read failure throws', (await throws(() => kvGet('k'))).startsWith('D1'));
check('d1: list failure throws', (await throws(() => kvList('a'))).startsWith('D1'));
fail = (u) => (u.includes('/d1/') ? Response.json({ success: false, errors: [{ code: 1, message: 'x' }], result: [] }) : null);
check('d1: an error result with HTTP 200 throws', (await throws(() => kvPut('k', 'v'))).startsWith('D1'));
fail = (u) => (u.includes('/d1/') ? Response.json({ success: true, result: [{ success: false }] }) : null);
check('d1: a failed statement throws', (await throws(() => kvGet('k'))).startsWith('D1'));
fail = null;
process.env.KV_BACKEND = 'dual';
fail = (u, init) => (u.includes('/values/') && init.method === 'PUT' ? new Response('boom', { status: 500 }) : null);
check('dual: KV write failure throws', (await throws(() => kvPut('k2', 'v'))).startsWith('KV write failed'));
fail = null;
const db = process.env.D1_DATABASE_ID; delete process.env.D1_DATABASE_ID;
check('d1 not configured -> throws', (await throws(() => kvGet('k'))).includes('D1_DATABASE_ID'));
process.env.D1_DATABASE_ID = db;
process.env.KV_BACKEND = 'D1 ';
check('an unknown KV_BACKEND throws (no silent global fallback)', (await throws(async () => kvBackend())).includes('KV_BACKEND'));
process.env.KV_BACKEND = '';
check('unset KV_BACKEND = kv (production unchanged until switched)', kvBackend() === 'kv');

console.log('\nkv mode is untouched');
process.env.KV_BACKEND = 'kv'; reset();
await kvPut('p', 'q', 120); await kvGet('p'); await kvList(''); await kvDel('p');
check('kv mode never calls D1', calls.d1 === 0 && calls.kv === 4);

done();
