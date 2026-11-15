// SESSIONS-1: "Sign-in & security" — the account's own sessions (device, browser, place, masked IP, method, first/last
// seen, This device) with Sign out per session and Sign out all other devices, and the account's activity.
// Session ids are secrets: storage holds only their SHA-256. A signed-out session is dead at once, also inside the
// fresh-cookie grace (LOGIN-1). Only the owner sees or ends their own sessions.
// Run: npx tsx tests/sessions.test.mts
import { kv, seed, lic, check, done } from './harness.mts';
import { NextRequest } from 'next/server';

process.env.RELAY_MINT_SECRET = 'mint-secret';
const kvFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  if (String(url).startsWith('https://relay.powerguardian.cloud/mint/')) return Response.json({ token: 'sub.tok', jti: 'j', expires_at: 1 });
  return kvFetch(url, init);
};

const S = await import('../app/lib/session.ts');
const { parseUserAgent, maskIp, clientInfo, placeLabel } = await import('../app/lib/client-info.ts');
const { GET, POST } = await import('../app/api/account/security/route.ts');
const { POST: relaySession } = await import('../app/api/account/relay-session/route.ts');
const { GET: logout } = await import('../app/api/auth/logout/route.ts');
const { POST: magic } = await import('../app/api/auth/magic/route.ts');
const { POST: confirmLink } = await import('../app/api/auth/verify/route.ts');
const { createMagicToken } = await import('../app/lib/magic-link.ts');
const { listActivity, logAudit, ACTIVITY_MAX } = await import('../app/lib/audit.ts');
const { activityRow } = await import('../app/lib/security-view.ts');

const SITE = 'https://powerguardian.cloud';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const IPHONE_FX = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

seed(lic('acme-site', 'acme@acme.test', { claimed_by: 'a'.repeat(64), site_name: 'Acer' }), lic('mal-site', 'mallory@mallory.test', { site_name: 'Mal' }));

const hdr = (ua: string, ip: string, country = 'NL', city = '') => new Headers({ 'user-agent': ua, 'cf-connecting-ip': ip, 'cf-ipcountry': country, ...(city ? { 'cf-ipcity': city } : {}) });
const client = (ua: string, ip: string, country = 'NL', city = '') => clientInfo(hdr(ua, ip, country, city));
const api = (cookie: string, body?: unknown, o: { origin?: string | null } = {}) => {
  const h: Record<string, string> = { cookie: 'pg_session=' + cookie, 'user-agent': MAC_CHROME, 'cf-connecting-ip': '178.229.10.20', 'cf-ipcountry': 'NL' };
  if (body !== undefined) { h['content-type'] = 'application/json'; if (o.origin !== null) h.origin = o.origin ?? SITE; }
  const req = new Request(SITE + '/api/account/security', body === undefined ? { headers: h } : { method: 'POST', headers: h, body: JSON.stringify(body) });
  return body === undefined ? GET(req) : POST(req);
};
const listOf = async (cookie: string) => { const r = await api(cookie); return { status: r.status, ...(await r.json()) } as any; };

console.log('device, browser, place and IP — no library, no external geo service');
check('iPhone · Safari', JSON.stringify(parseUserAgent(IPHONE)) === JSON.stringify({ device: 'iPhone', browser: 'Safari' }));
check('Mac · Chrome', parseUserAgent(MAC_CHROME).device === 'Mac' && parseUserAgent(MAC_CHROME).browser === 'Chrome');
check('Windows PC · Edge (not Chrome)', parseUserAgent(WIN_EDGE).device === 'Windows PC' && parseUserAgent(WIN_EDGE).browser === 'Edge');
check('Android phone · Chrome', parseUserAgent(ANDROID).device === 'Android phone' && parseUserAgent(ANDROID).browser === 'Chrome');
check('Firefox on iPhone (FxiOS)', parseUserAgent(IPHONE_FX).browser === 'Firefox');
check('an iPad asking for the desktop site is still an iPad', parseUserAgent(IPAD_DESKTOP).device === 'iPad');
check('empty User-Agent → "Unknown device"', parseUserAgent('').device === 'Unknown device');
check('IPv4 masked to 178.229.x.x', maskIp('178.229.10.20') === '178.229.x.x');
check('IPv6 masked to its first two groups', maskIp('2a02:a46f:1234:5678::1') === '2a02:a46f:…');
const ci = clientInfo(hdr(IPHONE, '178.229.10.20', 'NL', 'Amsterdam'));
check('country and city from Cloudflare\'s own headers', ci.country === 'NL' && ci.city === 'Amsterdam' && placeLabel(ci.country, ci.city) === 'Amsterdam, Netherlands');
check('XX (unknown) and T1 (Tor) are not a country', clientInfo(hdr(IPHONE, '1.2.3.4', 'T1')).country === '' && clientInfo(hdr(IPHONE, '1.2.3.4', 'XX')).country === '');

console.log('\nstorage never holds a session id');
const t0 = Date.now();
const acmePhone = await S.createSession('acme@acme.test', { mfa: true, method: 'code', via: 'totp', client: client(IPHONE, '178.229.10.20', 'NL', 'Amsterdam'), now: t0 - 3 * 3600_000 });
const acmeMac = await S.createSession('acme@acme.test', { mfa: true, method: 'link', via: 'totp', client: client(MAC_CHROME, '84.241.1.2', 'NL') });
const acmeWin = await S.createSession('acme@acme.test', { mfa: true, method: 'link', via: 'recovery', client: client(WIN_EDGE, '91.12.3.4', 'DE', 'Berlin') });
const mallory = await S.createSession('mallory@mallory.test', { mfa: true, client: client(ANDROID, '10.0.0.1', 'US') });
const idOf = (c: string) => c.split('.')[1];
const dump = [...kv.entries()].map(([k, v]) => k + v).join('\n');
check('no KV key or value contains a session id', [acmePhone, acmeMac, acmeWin, mallory].every((c) => !dump.includes(idOf(c))));
check('the record is under session:h:<sha256(id)>', kv.has('session:h:' + await S.hashId(idOf(acmeMac))));
const idx = JSON.parse(kv.get('sessions:acme@acme.test')!);
check('the account index holds 3 hashes, nothing else', idx.length === 3 && idx.every((e: any) => /^[0-9a-f]{64}$/.test(e.h) && Object.keys(e).sort().join() === 'exp,h'));

console.log('\nthe owner\'s list');
let L = await listOf(acmeMac);
check('acme sees exactly her 3 sessions', L.status === 200 && L.sessions.length === 3);
const me = L.sessions[0];
check('"This device" is the one asking, listed first', me.current === true && me.device === 'Mac' && me.browser === 'Chrome' && L.sessions.filter((s: any) => s.current).length === 1);
const phone = L.sessions.find((s: any) => s.device === 'iPhone');
check('iPhone row: Safari, Amsterdam, Netherlands, 178.229.x.x, email code + authenticator', phone?.browser === 'Safari' && phone.place === 'Amsterdam, Netherlands' && phone.ip === '178.229.x.x' && phone.method === 'Email code + authenticator');
check('first and last seen are there', typeof phone?.created === 'number' && typeof phone.seen === 'number' && phone.created <= phone.seen);
const win = L.sessions.find((s: any) => s.device === 'Windows PC');
check('recovery-code sign-in says so', win?.method === 'Email link + recovery code' && win.place === 'Berlin, Germany');
const body = JSON.stringify(L);
check('the answer has no session id, no hash, no full IP, no User-Agent', [acmePhone, acmeMac, acmeWin].every((c) => !body.includes(idOf(c))) && !idx.some((e: any) => body.includes(e.h)) && !body.includes('84.241.1.2') && !body.includes('AppleWebKit'));
check('refs are 16 hex', L.sessions.every((s: any) => /^[0-9a-f]{16}$/.test(s.ref)));

console.log('\nlast seen is written at most once per 5 minutes');
const macKey = 'session:h:' + await S.hashId(idOf(acmeMac));
let writes = 0;
const countFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => { if ((init.method ?? 'GET') === 'PUT' && decodeURIComponent(String(url)).includes(macKey)) writes++; return countFetch(url, init); };
for (let i = 0; i < 5; i++) await S.getSession(acmeMac);
check('5 requests within a minute → no write', writes === 0);
await S.getSession(acmeMac, Date.now() + S.TOUCH_MS + 1000, client(MAC_CHROME, '84.241.9.9', 'BE'));
check('after 5 minutes → one write with the new last seen and place', writes === 1 && JSON.parse(kv.get(macKey)!).country === 'BE');
(globalThis as any).fetch = countFetch;

console.log('\nanother account cannot list or end them');
const M = await listOf(mallory);
check('mallory sees only her own session', M.status === 200 && M.sessions.length === 1 && !JSON.stringify(M).includes('Amsterdam'));
let r = await api(mallory, { action: 'revoke', ref: phone.ref });
check('mallory signs out acme\'s iPhone by its ref → 404', r.status === 404);
check('…and acme\'s iPhone is still signed in', (await S.getSession(acmePhone)) === 'acme@acme.test');
r = await api(mallory, { action: 'revoke_others' });
const after = await listOf(acmeMac);
check('mallory\'s "sign out all other devices" never touches acme', r.status === 200 && after.sessions.length === 3);
r = await api(mallory, { action: 'revoke', ref: phone.ref, email: 'acme@acme.test' } as any);
check('naming acme\'s email in the request changes nothing → 404', r.status === 404);

console.log('\nforged, old and cross-site requests');
const forged = acmeMac.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
check('a forged cookie cannot list → 401', (await api(forged)).status === 401);
check('a forged cookie cannot sign out → 401', (await api(forged, { action: 'revoke', ref: phone.ref })).status === 401);
const old = await S.createSession('acme@acme.test', { now: Date.now() - 2 * 86_400_000 });
check('an expired cookie cannot sign out → 401', (await api(old, { action: 'revoke_others' })).status === 401);
check('no Origin → 403', (await api(acmeMac, { action: 'revoke', ref: phone.ref }, { origin: null })).status === 403);
check('another Origin → 403', (await api(acmeMac, { action: 'revoke', ref: phone.ref }, { origin: 'https://evil.example' })).status === 403);
check('signing out "This device" here → 400 (use Sign out)', (await api(acmeMac, { action: 'revoke', ref: me.ref })).status === 400);
check('a malformed ref → 404', (await api(acmeMac, { action: 'revoke', ref: '../../x' })).status === 404);
check('after all that, acme still has 3 sessions', (await listOf(acmeMac)).sessions.length === 3);

console.log('\nSign out one session');
r = await api(acmeMac, { action: 'revoke', ref: phone.ref });
check('acme signs out her iPhone → 200', r.status === 200);
check('the iPhone cookie is dead', (await S.getSession(acmePhone)) === null);
check('it is gone from the list and the index', (await listOf(acmeMac)).sessions.length === 2 && JSON.parse(kv.get('sessions:acme@acme.test')!).length === 2);
const phoneRec = JSON.parse(kv.get('session:h:' + await S.hashId(idOf(acmePhone)))!);
check('its record is a tombstone without the browser data', phoneRec.revoked === true && !phoneRec.ua && !phoneRec.ip);
check('signing it out again → 404', (await api(acmeMac, { action: 'revoke', ref: phone.ref })).status === 404);
check('the dead cookie cannot use the API → 401', (await api(acmePhone)).status === 401);

console.log('\nthe fresh-cookie grace (LOGIN-1) honours sign-out');
const fresh = await S.createSession('acme@acme.test', { client: client(IPHONE_FX, '5.6.7.8') });
const freshKey = 'session:h:' + await S.hashId(idOf(fresh));
const saved = kv.get(freshKey)!; kv.delete(freshKey);
check('(control) a fresh cookie KV has not caught up with is trusted', (await S.getSession(fresh)) === 'acme@acme.test');
kv.set(freshKey, saved);
const fref = (await listOf(acmeMac)).sessions.find((s: any) => s.browser === 'Firefox').ref;
await api(acmeMac, { action: 'revoke', ref: fref });
check('signed out 10 s after sign-in → refused at once, inside the 2-minute grace', (await S.getSession(fresh, Date.now() + 10_000)) === null);
const fresh2 = await S.createSession('acme@acme.test');
await logout(new NextRequest(SITE + '/api/auth/logout', { headers: { cookie: 'pg_session=' + fresh2 } }));
check('Sign out (logout) inside the grace → that cookie is dead too', (await S.getSession(fresh2)) === null);

console.log('\nSign out all other devices');
const extra = await S.createSession('acme@acme.test', { client: client(ANDROID, '9.9.9.9') });
const before = (await listOf(acmeMac)).sessions.length;
r = await api(acmeMac, { action: 'revoke_others' });
const ro = await r.json();
check(`signs out the ${before - 1} others, keeps this one`, r.status === 200 && ro.signed_out === before - 1 && (await S.getSession(acmeMac)) === 'acme@acme.test');
check('the others are dead', (await S.getSession(acmeWin)) === null && (await S.getSession(extra)) === null);
check('the list shows only This device', (await listOf(acmeMac)).sessions.length === 1);
check('mallory is untouched', (await S.getSession(mallory)) === 'mallory@mallory.test');

console.log('\nsessions from before this release');
const legacyId = 'c'.repeat(64);
kv.set('session:' + legacyId, JSON.stringify({ email: 'acme@acme.test', expires: Date.now() + 86_400_000, mfa: true }));
check('an old record still signs in', (await S.getSession(legacyId)) === 'acme@acme.test');
const withLegacy = await listOf(acmeMac);
const lrow = withLegacy.sessions.find((s: any) => !s.current);
check('…and is now in the list ("before this list existed" → two-step)', withLegacy.sessions.length === 2 && lrow?.method === 'Two-step sign-in');
await api(acmeMac, { action: 'revoke', ref: lrow.ref });
check('signing it out kills it, although its old record is still in KV', (await S.getSession(legacyId)) === null);

console.log('\nat most 20 sessions per account; the oldest is signed out');
const many: string[] = [];
for (let i = 0; i < S.MAX_SESSIONS + 2; i++) many.push(await S.createSession('cap@x.test', { now: Date.now() - (30 - i) * 60_000 }));
check('index capped at 20', JSON.parse(kv.get('sessions:cap@x.test')!).length === S.MAX_SESSIONS);
check('the two oldest are dead, the newest alive', (await S.getSession(many[0])) === null && (await S.getSession(many[1])) === null && (await S.getSession(many.at(-1)!)) === 'cap@x.test');

console.log('\nactivity: what happened on the account');
const t = await createMagicToken('new@x.test');
const ok = await confirmLink(new NextRequest(SITE + '/api/auth/verify', { method: 'POST', body: new URLSearchParams({ token: t }).toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITE, 'user-agent': IPHONE, 'cf-connecting-ip': '178.229.10.20', 'cf-ipcountry': 'NL', 'cf-ipcity': 'Utrecht' } }));
const newCookie = (ok.headers.get('set-cookie') ?? '').match(/pg_session=([^;]*)/)?.[1] ?? '';
let act = await listActivity('new@x.test');
check('a sign-in by link → "Signed in · Email link", device, place, masked IP', act[0]?.action === 'auth.signin' && act[0].detail === 'Email link' && act[0].device === 'iPhone · Safari' && act[0].place === 'Utrecht, Netherlands' && act[0].ip === '178.229.x.x');
check('the new session knows how it was made', (await listOf(newCookie)).sessions[0]?.method === 'Email link');
for (let i = 0; i < 3; i++) {
  await magic(new Request(SITE + '/api/auth/magic', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.' + i }, body: JSON.stringify({ email: 'new@x.test', code: true }) }));
}
act = await listActivity('new@x.test');
check('3 code requests within the hour are one line "(3×)", not three', act[0]?.action === 'auth.request' && act[0].n === 3 && activityRow(act[0]).title === 'Sign-in code requested (3×)' && act.length === 2);

const rs = await relaySession(new Request(SITE + '/api/account/relay-session', { method: 'POST', headers: { cookie: 'pg_session=' + acmeMac, 'content-type': 'application/json', 'user-agent': MAC_CHROME, 'cf-connecting-ip': '84.241.1.2' }, body: JSON.stringify({ license_id: 'acme-site' }) }));
act = await listActivity('acme@acme.test');
const co = act.find((e) => e.action === 'console.open');
check('Open Console is logged per site (closes the audit gap)', rs.status === 200 && co?.site === 'Acer' && activityRow(co!).title === 'Console opened · Acer' && activityRow(co!).detail === 'from your account');
const audit = [...kv.keys()].filter((k) => k.startsWith('audit:')).map((k) => JSON.parse(kv.get(k)!)).filter((e) => e.action === 'console.open');
check('…and in the full audit trail, with the licence id', audit.some((e) => e.license_id === 'acme-site' && e.email === 'acme@acme.test'));
check('sign-out and sign-out-all are in acme\'s activity', act.some((e) => e.action === 'session.revoke' && e.detail === 'iPhone · Safari') && act.some((e) => e.action === 'session.revoke_others' && /devices?$/.test(e.detail ?? '')));
check('nothing of acme\'s is in mallory\'s activity', (await listActivity('mallory@mallory.test')).length === 0);
const R = await listOf(mallory);
check('mallory\'s API answer has no activity of acme', R.activity.length === 0);

for (let i = 0; i < ACTIVITY_MAX + 10; i++) await logAudit({ actor: 'cap@x.test', role: 'owner', action: 'site.rename', email: 'cap@x.test', detail: `a → b${i}` });
check(`the activity keeps the newest ${ACTIVITY_MAX}`, (await listActivity('cap@x.test')).length === ACTIVITY_MAX && (await listActivity('cap@x.test'))[0].detail === `a → b${ACTIVITY_MAX + 9}`);
kv.set('activity:old@x.test', JSON.stringify([{ at: new Date(Date.now() - 91 * 86_400_000).toISOString(), action: 'auth.signin' }, { at: new Date().toISOString(), action: 'auth.signout' }]));
check('lines older than 90 days are not shown', (await listActivity('old@x.test')).length === 1);
await logAudit({ actor: 'admin', role: 'admin', action: 'token.rotate', email: 'cap@x.test' });
check('internal admin actions (token rotate) are not in the owner\'s activity', (await listActivity('cap@x.test'))[0].action === 'site.rename');
await logAudit({ actor: 'admin', role: 'admin', action: 'site.rename', email: 'cap@x.test', detail: 'x → y' });
check('a rename by support says so', activityRow((await listActivity('cap@x.test'))[0]).title === 'Site renamed by PowerGuardian support');

done();
