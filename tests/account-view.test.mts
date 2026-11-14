// ACCOUNT-UI: the account page's view model — one tile per site (one status line, 24 h power history), unused licenses apart,
// no internal names; and the power history the heartbeat keeps (lib/power-history.ts).
// Run: npx tsx tests/account-view.test.mts
import { lic, check, done, DAY } from './harness.mts';

const { accountView, siteName, connectorsText, termText, inUse, statusLine } = await import('../app/lib/account-view.ts');
const { recordBeat, last24h, SLOT_MS, SLOTS } = await import('../app/lib/power-history.ts');
const now = Date.now();
const st = (o: Record<string, unknown> = {}) => ({ site_name: 'x', controller_version: '0.1.115', devices: [], received_at: now, ...o }) as any;

const thuis = lic('L1', 'roy@x.nl', { plan: 'founder', connector_limit: 0, site_id: 'default-site', site_name: 'Thuis', claimed_by: 'a'.repeat(64), claimed_hostname: 'nanopi-r3s' }) as any;
const kantoor = lic('L2', 'roy@x.nl', { plan: 'founder', connector_limit: 0, site_id: 'default-site', minted_from: 'L1', claimed_by: 'b'.repeat(64), claimed_hostname: 'hp-prodesk' }) as any;
const spare = lic('spare', 'roy@x.nl', { plan: 'pro', site_id: 'default-site' }) as any;
const addon = lic('addon', 'roy@x.nl', { plan: 'addon_connector', parent_id: 'spare', connector_limit: 3 }) as any;
const all = [thuis, kantoor, spare, addon];

console.log('names');
check('the given site name wins', siteName(thuis, st({ site_name: 'Other' })) === 'Thuis');
check('no name: the name the controller reports', siteName(kantoor, st({ site_name: 'Kantoor' })) === 'Kantoor');
check('never the internal site_id', siteName(kantoor, st({ site_name: 'default-site' })) === 'Unnamed site');
check('never the hostname', siteName(kantoor, st({ site_name: 'hp-prodesk' })) === 'Unnamed site' && siteName({ ...kantoor, site_name: 'HP-ProDesk' }, null) === 'Unnamed site');
check('never the license id', siteName({ ...kantoor, site_name: 'l2' }, null) === 'Unnamed site');
check('a copy’s hostname is no name either', siteName({ ...kantoor, copies: [{ controller_id: 'c', hostname: 'copybox', first_seen: '' }] }, st({ site_name: 'copybox' })) === 'Unnamed site');

console.log('\nsites and unused licenses');
const v = accountView([
  { lic: thuis, status: st({ devices: [{ name: 'Eaton', state: 'online', ups_status: 'OL' }] }) },
  { lic: kantoor, status: st({ site_name: 'default-site', received_at: now - 600_000 }) },
  { lic: spare, status: null },
  { lic: addon, status: null },
], all, now);
check('each controller-held license is one site card', v.sites.length === 2 && v.sites.map((s) => s.license.id).join() === 'L1,L2');
check('the license travels with its site (plan on the card)', v.sites[0].license.plan === 'founder' && v.sites[0].license.details === '1 connector · unlimited · Never expires' && v.sites[0].name === 'Thuis');
check('online state per site', v.sites[0].online === true && v.sites[1].online === false);
check('a license no controller holds goes to “not in use”', v.unused.length === 1 && v.unused[0].id === 'spare');
check('connector add-ons are neither sites nor unused licenses', !v.sites.some((s) => s.license.id === 'addon') && !v.unused.some((l) => l.id === 'addon'));
check('no “default-site” in any card name', !v.sites.some((s) => /default-site/.test(s.name)));
check('only display data: no token, e-mail, site_id, LAN or the controller’s own site_name', !/tok-|roy@x\\.nl|site_id|default-site|"lan"|claimed_by/.test(JSON.stringify(v)), JSON.stringify(v).slice(0, 200));
check('a license that reported before hardware IDs (no claimed_by) is in use', inUse(spare, st()) && !inUse(spare, null));

console.log('\none status line per tile');
const dv = (n: string, ups: string, state = 'online') => ({ name: n, state, version: '', ups_status: ups, battery_pct: 90, load_pct: 10, runtime_sec: 600, last_seen: 1 });
const sl = (o: Record<string, unknown>) => statusLine(st(o), now);
check('online, all on mains: “Online · 3 UPSes on mains”, word Guarded', sl({ devices: [dv('a', 'OL'), dv('b', 'OL CHRG'), dv('c', 'OL')] }).text === 'Online · 3 UPSes on mains' && sl({ devices: [dv('a', 'OL')] }).word === 'Guarded');
check('any UPS on battery: “On battery · 1 UPS” in amber', (() => { const l = sl({ devices: [dv('a', 'OL'), dv('b', 'OB DISCHRG')] }); return l.text === 'On battery · 1 UPS' && l.tone === 'warn'; })());
check('low battery wins, red', (() => { const l = sl({ devices: [dv('a', 'OB'), dv('b', 'OB LB')] }); return l.text === 'Low battery · 1 UPS' && l.tone === 'danger'; })());
check('a connector offline = attention', sl({ devices: [dv('a', 'OL'), dv('b', '', 'offline')] }).text === 'Online · 1 connector offline');
const off = sl({ received_at: now - 3 * 3600_000, devices: [dv('a', 'OL')] });
check('offline: “Offline · last seen 3 h ago”, never the stale “on mains”', off.text === 'Offline · last seen 3 h ago' && !/mains/.test(JSON.stringify(off)));
check('the offline tile carries no device readings', !/mains|Eaton/.test(JSON.stringify(v.sites[1])) && v.sites[1].line.tone === 'offline');
check('never reported: waiting', statusLine(null, now).text === 'Waiting for the first contact');

console.log('\n24 h power history (kept in the status record by the heartbeat)');
const T0 = Math.floor(now / SLOT_MS) * SLOT_MS;
const mains = [dv('a', 'OL')], bat = [dv('a', 'OB DISCHRG')];
let h = recordBeat(null, mains, T0);
check('first heartbeat: one green slot, everything before it is “no data” (nothing invented)', h.s === '-'.repeat(SLOTS - 1) + 'm');
h = recordBeat(h, bat, T0 + 60_000);
check('a slot keeps the worst state seen in it (battery over mains)', h.s.endsWith('b'));
h = recordBeat(h, mains, T0 + SLOT_MS + 1);
check('the next slot starts fresh', h.s.endsWith('bm') && h.at === Math.floor(T0 / SLOT_MS) + 1);
h = recordBeat(h, mains, T0 + 4 * SLOT_MS + 1);
check('slots without a heartbeat stay “no data”', h.s.endsWith('bm--m'));
check('read now: slots after the last heartbeat are “no data”, never a stale state', last24h(h, T0 + 6 * SLOT_MS + 1).slots.join('').endsWith('bm--m--'));
check('no history yet: an all-grey bar, flagged empty', (() => { const r = last24h(undefined, now); return r.empty && r.slots.every((x) => x === '-') && r.slots.length === SLOTS; })());
check('older than 24 h falls off', last24h(h, T0 + 60 * SLOT_MS).empty);
check('junk history is ignored', recordBeat({ at: 1, s: 'xx' } as any, mains, T0).s === '-'.repeat(SLOTS - 1) + 'm');
check('online without UPS data: grey “n”, not green', recordBeat(null, [], T0).s.endsWith('n'));
check('a site without history in its record: the tile says so', v.sites[0].power.empty === true);
const { POST: heartbeat } = await import('../app/api/cloud/heartbeat/route.ts');
const { kv, seed } = await import('./harness.mts');
const hb = lic('hb', 'hb@x.nl', { claimed_by: 'f'.repeat(64) }) as any; seed(hb);
await heartbeat(new Request('http://x/api/cloud/heartbeat', { method: 'POST', headers: { authorization: 'Bearer ' + hb.token, 'content-type': 'application/json' }, body: JSON.stringify({ controller_id: 'f'.repeat(64), site_name: 'HB', devices: [{ name: 'U', state: 'online', ups_status: 'OL' }] }) }));
const saved = JSON.parse(kv.get('sitestatus:hb') ?? '{}');
check('the heartbeat writes the history into the status record it already writes', saved.power?.s?.endsWith('m') && saved.power.s.length === SLOTS, JSON.stringify(saved.power));

console.log('\nlicense facts on the card');
check('unlimited', connectorsText(thuis, all, 1) === '1 connector · unlimited' && connectorsText(thuis, all, null) === 'Unlimited connectors');
check('capacity includes running add-ons', connectorsText(spare, all, 2) === '2 of 8 connectors' && connectorsText(spare, all, null) === 'Up to 8 connectors');
check('term', termText(thuis) === 'Never expires' && termText({ ...spare, expires_at: new Date(now + 30 * DAY).toISOString() }).startsWith('Valid until '));

console.log('\nthe page never renders the internal site_id or hostnames as names');
const fs = await import('node:fs');
const src = ['app/account/page.tsx', 'app/account/components/SitesSection.tsx'].map((f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
check('site_id is never read by the page', !/\.site_id\b/.test(src));
check('the tile title comes from siteName (account-view), not hostname', /site-name[^>]*>\{name\}/.test(src) && !/claimed_hostname\s*\?\?\s*['"]/.test(src));

done();
