// HIST-24H: the controller sends its own 24 h power summary with every heartbeat (power_24h); the cloud checks it strictly,
// lets it win over its own heartbeat-derived history for the slots it knows, and keeps its own history for older controllers.
// A controller without any UPS says so ("no_ups") and its tile shows that, not the grey of "no data / offline".
// Run: npx tsx tests/power-ingest.test.mts
import { kv, seed, lic, get, check, done } from './harness.mts';

const { parseControllerPower, applyControllerPower, recordBeat, last24h, SLOT_MS, SLOTS } = await import('../app/lib/power-history.ts');
const { accountView, statusLine } = await import('../app/lib/account-view.ts');
const { POST: heartbeat } = await import('../app/api/cloud/heartbeat/route.ts');

const now = Date.now();
const AT = Math.floor(now / SLOT_MS);
const M = (s: string) => s.replace(/[^b]/g, '0').replace(/b/g, 'c'); // 12 min in every battery slot
const good = (o: Record<string, unknown> = {}) => {
  const s = 'u'.repeat(10) + 'm'.repeat(20) + 'b' + 'm'.repeat(17);
  return { v: 1, state: 'ups', at: AT, s, m: M(s), ...o };
};

console.log('strict shape check of power_24h');
check('a well-formed summary is accepted', parseControllerPower(good(), now)?.state === 'ups');
check('"no_ups" is accepted', JSON.stringify(parseControllerPower({ v: 1, state: 'no_ups' }, now)) === '{"state":"no_ups"}');
const bad: [string, unknown][] = [
  ['null', null], ['a string', 'mmmm'], ['an array', [good()]], ['a number', 1],
  ['unknown version', good({ v: 2 })], ['no version', (() => { const g: any = good(); delete g.v; return g; })()],
  ['unknown state', good({ state: 'battery' })], ['an extra key', good({ name: 'Eaton 5PX' })],
  ['47 slots', good({ s: 'm'.repeat(47), m: '0'.repeat(47) })], ['49 slots', good({ s: 'm'.repeat(49), m: '0'.repeat(49) })],
  ['other letters in s', good({ s: 'x'.repeat(48), m: '0'.repeat(48) })], ['markup in s', good({ s: '<b>' + 'm'.repeat(45), m: '0'.repeat(48) })],
  ['31 minutes (base 32 "v")', good({ s: 'b'.repeat(48), m: 'v'.repeat(48) })],
  ['a battery slot without minutes', good({ s: 'b'.repeat(48), m: '0'.repeat(48) })],
  ['minutes in a mains slot', good({ s: 'm'.repeat(48), m: '1' + '0'.repeat(47) })],
  ['a fractional slot number', good({ at: AT + 0.5 })], ['a slot number as text', good({ at: String(AT) })],
  ['a clock 2 slots ahead', good({ at: AT + 2 })], ['a clock a day behind', good({ at: AT - 48 })],
  ['no_ups with history attached', { v: 1, state: 'no_ups', s: 'm'.repeat(48) }],
  ['an oversize string', good({ s: 'm'.repeat(100_000) })],
];
for (const [what, v] of bad) check(`refused: ${what}`, parseControllerPower(v, now) === null);
check('one slot of clock difference is fine', parseControllerPower(good({ at: AT - 1 }), now) !== null && parseControllerPower(good({ at: AT + 1 }), now) !== null);

console.log('\nmerge: the controller wins where it knows, the cloud history stays where it does not');
let cloud = recordBeat(null, [{ name: 'U', state: 'online', version: '', ups_status: 'OL', battery_pct: 100, load_pct: 0, runtime_sec: 0, last_seen: 0 }], now);
check('the cloud alone: one slot', cloud.s === '-'.repeat(SLOTS - 1) + 'm');
const c = parseControllerPower(good(), now)!;
let merged = applyControllerPower(cloud, c as any);
check('the controller’s 38 known slots fill the strip at once', merged.s === '-'.repeat(10) + 'm'.repeat(20) + 'b' + 'm'.repeat(17), merged.s);
check('battery minutes come from the controller', merged.m === '0'.repeat(30) + 'c' + '0'.repeat(17), merged.m);
check('the controller’s battery wins over the cloud’s mains in the same slot', applyControllerPower(cloud, parseControllerPower(good({ s: 'u'.repeat(47) + 'b', m: '0'.repeat(47) + '3' }), now) as any).s.endsWith('b'));
const cloudBat = { at: AT, s: '-'.repeat(40) + 'bbbbmmmm', m: '0'.repeat(40) + '5555' + '0000' };
merged = applyControllerPower(cloudBat, parseControllerPower(good({ s: 'u'.repeat(48), m: '0'.repeat(48) }), now) as any);
check('"u" (the controller has no data) keeps the cloud’s own slots', merged.s === cloudBat.s && merged.m === cloudBat.m);
merged = applyControllerPower(cloudBat, parseControllerPower(good({ at: AT + 1, s: 'm'.repeat(48), m: '0'.repeat(48) }), now) as any);
check('a controller clock one slot ahead: its slots are placed by number, the future one is dropped', merged.at === AT && merged.s === 'm'.repeat(48));
merged = applyControllerPower(cloudBat, parseControllerPower(good({ at: AT - 1, s: 'b' + 'm'.repeat(47), m: '1' + '0'.repeat(47) }), now) as any);
check('a controller clock one slot behind: the slot it does not cover is the cloud’s', merged.s === 'm'.repeat(47) + 'm' && merged.s[47] === cloudBat.s[47]);
check('the result is a valid history (read back for the tile)', last24h(merged, now).slots.length === SLOTS && !last24h(merged, now).empty);

console.log('\nthe heartbeat');
const CID = 'e'.repeat(64);
const hb = lic('hist', 'hist@x.nl', { claimed_by: CID }) as any; seed(hb);
const beat = (body: Record<string, unknown>, token = hb.token) => heartbeat(new Request('http://x/api/cloud/heartbeat', {
  method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  body: JSON.stringify({ controller_id: CID, site_name: 'HP', devices: [{ name: 'U', state: 'online', ups_status: 'OL' }], ...body }),
}));
const back = (ms: number) => { const s = get('sitestatus:hist'); s.received_at -= ms; kv.set('sitestatus:hist', JSON.stringify(s)); };
let r = await beat({ power_24h: good() });
let s = get('sitestatus:hist');
check('first heartbeat of a controller that ran for weeks: the strip is full at once', r.status === 200 && s.power.s === '-'.repeat(10) + 'm'.repeat(20) + 'b' + 'm'.repeat(17), s.power?.s);
check('no device details stored with it', !/Eaton|name/.test(JSON.stringify(s.power)));
back(60_000);
r = await beat({ power_24h: { ...good(), s: 'x'.repeat(48) } });
s = get('sitestatus:hist');
check('a malformed summary is ignored, the heartbeat (and its lease) still goes through', r.status === 200 && (await r.json()).state === 'licensed' && s.power.s.length === SLOTS);
check('…and the history it already had stays', s.power.s.includes('b'));
back(60_000);
r = await beat({});
s = get('sitestatus:hist');
check('an older controller (no power_24h): the cloud keeps its own history going', r.status === 200 && s.power.s.endsWith('m') && s.no_ups !== true);

console.log('\na controller without any UPS');
back(60_000);
await beat({ devices: [], power_24h: { v: 1, state: 'no_ups' } });
s = get('sitestatus:hist');
check('stored as no_ups', s.no_ups === true);
const view = accountView([{ lic: hb, status: s }], [hb], Date.now());
check('the tile knows: noUps', view.sites[0].noUps === true);
check('the status line says “No UPS on this controller”, not “no UPS data yet”', statusLine(s, Date.now()).text === 'Online · No UPS on this controller', statusLine(s, Date.now()).text);
back(60_000);
await beat({ power_24h: good() });
check('a UPS added later: no_ups is cleared', get('sitestatus:hist').no_ups !== true);
const off = { ...s, received_at: Date.now() - 3 * 3600_000 };
check('offline stays “Offline”, the no-UPS look stays on the strip', statusLine(off, Date.now()).word === 'Offline' && accountView([{ lic: hb, status: off }], [hb], Date.now()).sites[0].noUps === true);

console.log('\nisolation: a controller only writes its own site');
const other = lic('other', 'other@x.nl', { claimed_by: 'f'.repeat(64) }) as any; seed(other);
const otherStatus = { site_name: 'Other', controller_version: '0.1.116', devices: [], received_at: Date.now() - 600_000, power: { at: AT, s: '-'.repeat(47) + 'm', m: '0'.repeat(48) } };
kv.set('sitestatus:other', JSON.stringify(otherStatus));
back(60_000);
r = await beat({ license_id: 'other', site_id: 'other', power_24h: good({ s: 'b'.repeat(48), m: 'u'.repeat(48) }) });
check('hist’s token with another site’s id in the body: only hist’s own record changes', r.status === 200 && kv.get('sitestatus:other') === JSON.stringify(otherStatus) && get('sitestatus:hist').power.s === 'b'.repeat(48));
r = await beat({ power_24h: good({ s: 'b'.repeat(48), m: 'u'.repeat(48) }) }, 'tok-other-' + 'b'.repeat(20));
check('a guessed token → 401, nothing written', r.status === 401 && kv.get('sitestatus:other') === JSON.stringify(otherStatus));

done();
