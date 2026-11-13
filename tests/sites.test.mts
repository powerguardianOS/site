// SITE-2: GET /api/cloud/sites — a controller lists the sites of its own account (for the site switcher).
// Run: npx tsx tests/sites.test.mts
import { kv, put, seed, lic, check, done } from './harness.mts';

const { GET: sites } = await import('../app/api/cloud/sites/route.ts');
const { POST: heartbeat } = await import('../app/api/cloud/heartbeat/route.ts');

const CA = 'a'.repeat(64), CB = 'b'.repeat(64), CC = 'c'.repeat(64), CX = 'e'.repeat(64);
const now = Date.now();
const home = lic('home', 'roy@x.nl', { site_name: 'Thuis', claimed_by: CA });
const office = lic('office', 'roy@x.nl', { site_name: 'Kantoor', claimed_by: CB });
const addon = lic('addon', 'roy@x.nl', { plan: 'addon_connector', parent_id: 'home' });
const other = lic('other', 'eve@x.nl', { site_name: 'Eve', claimed_by: CC });
seed(home, office, addon, other);
const st = (o: Record<string, unknown>) => ({ site_name: 'x', controller_version: '0.1.115', devices: [], received_at: now, ...o });
put('sitestatus:home', st({ model: 'HP ProDesk 400 G3 DM', lan: ['192.168.10.175'], devices: [{ name: 'Eaton', state: 'online', version: '', ups_status: 'OL', battery_pct: 100, load_pct: 10, runtime_sec: 3000, last_seen: 1 }] }));
put('sitestatus:office', st({ model: 'Acer Veriton', lan: ['192.168.10.235'], received_at: now - 600_000 }));
put('sitestatus:other', st({ model: 'Secret box', lan: ['10.0.0.9'] }));

const get = (token: string, cid?: string) => sites(new Request('http://x/api/cloud/sites', { headers: { authorization: 'Bearer ' + token, ...(cid ? { 'x-controller-id': cid } : {}) } }));
const json = async (r: Response) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }) as any;

console.log('auth');
check('no token → 401', (await sites(new Request('http://x/api/cloud/sites'))).status === 401);
check('unknown token → 401', (await get('nope')).status === 401);
check('a copy (not the holder) gets no list → 403', (await get(home.token, CX)).status === 403);
check('revoked licence → 403', await (async () => { put('license:home', { ...home, status: 'revoked' }); const s = (await get(home.token, CA)).status; put('license:home', home); return s === 403; })());

console.log('\nlist');
const r = await json(await get(home.token, CA));
check('200 with both sites of the account', r.status === 200 && r.sites?.length === 2, JSON.stringify(r).slice(0, 200));
check('never another account’s site', !JSON.stringify(r).includes('Eve') && !JSON.stringify(r).includes('Secret box') && !JSON.stringify(r).includes('10.0.0.9'));
check('add-on licences are not sites', !r.sites.some((s: any) => s.id === 'addon'));
const h = r.sites.find((s: any) => s.id === 'home'), o = r.sites.find((s: any) => s.id === 'office');
check('the caller is marked this', h.this === true && o.this === false);
check('says whether the remote console is in the site’s plan', h.console === true && o.console === true);
check('name, model, version, LAN address', h.name === 'Thuis' && h.model === 'HP ProDesk 400 G3 DM' && h.controller_version === '0.1.115' && h.lan[0] === '192.168.10.175');
check('status from the heartbeat: online + on mains = ok', h.online === true && h.tone === 'ok');
check('a site silent for 10 min is offline', o.online === false && o.tone === 'offline' && typeof o.last_seen === 'number');
check('no secrets or identities in the answer', !/tok-|token|email|roy@x\.nl|claimed_by|hostname|aaaaaaaa/.test(JSON.stringify(r)), JSON.stringify(r).slice(0, 300));
put('sitestatus:office', st({ received_at: now, devices: [{ name: 'U', state: 'online', version: '', ups_status: 'OB DISCHRG', battery_pct: 80, load_pct: 1, runtime_sec: 1, last_seen: 1 }] }));
check('on battery = warn', (await json(await get(home.token, CA))).sites.find((s: any) => s.id === 'office').tone === 'warn');
put('sitestatus:office', st({ received_at: now, devices: [{ name: 'U', state: 'online', version: '', ups_status: 'OB LB', battery_pct: 5, load_pct: 1, runtime_sec: 1, last_seen: 1 }] }));
check('low battery = danger', (await json(await get(home.token, CA))).sites.find((s: any) => s.id === 'office').tone === 'danger');
kv.delete('sitestatus:office');
const w = (await json(await get(home.token, CA))).sites.find((s: any) => s.id === 'office');
check('a site that never reported is listed as waiting, without address', w.online === false && w.tone === 'offline' && w.last_seen === null && w.lan.length === 0);

console.log('\nheartbeat stores the LAN address (private only) and the model');
const hb = (lan: unknown) => heartbeat(new Request('http://x/api/cloud/heartbeat', { method: 'POST', headers: { authorization: 'Bearer ' + other.token, 'content-type': 'application/json' }, body: JSON.stringify({ controller_id: CC, site_name: 'Eve', model: 'NanoPi R3S', lan }) }));
kv.delete('sitestatus:other');
await hb(['192.168.1.20', '8.8.8.8', '10.1.2.3', '172.16.5.4', '172.32.0.1', '100.64.0.1', 'evil<script>', '169.254.1.1', '127.0.0.1', '192.168.1.21', '192.168.1.22', '192.168.1.23']);
const saved = JSON.parse(kv.get('sitestatus:other')!);
check('public, CGNAT, link-local, loopback and junk are dropped', JSON.stringify(saved.lan) === JSON.stringify(['192.168.1.20', '10.1.2.3', '172.16.5.4', '192.168.1.21']), JSON.stringify(saved.lan));
check('model is kept', saved.model === 'NanoPi R3S');
kv.delete('sitestatus:other');
await hb('192.168.1.20');
check('a non-list LAN field stores nothing', JSON.stringify(JSON.parse(kv.get('sitestatus:other')!).lan) === '[]');

console.log('\nconsole link to another site of the account (through the relay)');
process.env.RELAY_MINT_SECRET = 'mint-secret';
const { POST: consoleLink } = await import('../app/api/cloud/sites/console/route.ts');
const mints: { url: string; secret: string; body: any }[] = [];
const kvFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  if (String(url).startsWith('https://relay.powerguardian.cloud/mint/')) {
    mints.push({ url: String(url), secret: init.headers['X-Mint-Secret'], body: JSON.parse(init.body) });
    return Response.json({ token: 'sub-' + String(url).split('/').pop(), jti: 'j', expires_at: 1 });
  }
  return kvFetch(url, init);
};
put('sitestatus:office', st({ received_at: Date.now() }));
put('sitestatus:home', st({ received_at: Date.now() }));
const ask = (token: string, site: unknown, cid = CA) => consoleLink(new Request('http://x/api/cloud/sites/console', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'x-controller-id': cid, 'content-type': 'application/json' }, body: JSON.stringify({ site_id: site }) }));
const c1 = await json(await ask(home.token, 'office'));
check('a site of the same account: a relay console link', c1.status === 200 && c1.console_url === 'https://relay.powerguardian.cloud/console/sub-office', JSON.stringify(c1));
check('minted for that site, customer scope, short-lived, with the mint secret', mints.length === 1 && mints[0].url.endsWith('/mint/office') && mints[0].secret === 'mint-secret' && mints[0].body.scope === 'customer' && mints[0].body.ttl_seconds <= 600);
check('no token of any kind in the answer besides the console link', !/tok-/.test(JSON.stringify(c1)));
check('another account’s site → 404, nothing minted', (await ask(home.token, 'other')).status === 404 && mints.length === 1);
check('an add-on licence is not a site → 404', (await ask(home.token, 'addon')).status === 404);
check('no token → 401', (await consoleLink(new Request('http://x', { method: 'POST', body: '{}' }))).status === 401);
check('a copy (not the holder) → 403', (await ask(home.token, 'office', CX)).status === 403);
put('sitestatus:office', st({ received_at: Date.now() - 600_000 }));
const off = await json(await ask(home.token, 'office'));
check('an offline site → 409 offline', off.status === 409 && off.error === 'offline');
put('sitestatus:office', st({ received_at: Date.now() }));
put('license:office', { ...office, plan: 'home' });
const hp = await json(await ask(home.token, 'office'));
check('a Home plan has no remote console → 403 console_not_in_plan', hp.status === 403 && hp.error === 'console_not_in_plan');
put('license:office', office);
check('junk site id → 400', (await ask(home.token, '../x')).status === 400 && (await ask(home.token, 7)).status === 400);

done();
