/* eslint-disable @typescript-eslint/no-explicit-any -- API responses in tests are loosely typed on purpose */
import { kv, put, get, seed, lic, check, done, DAY } from './harness.mts';
import { POST as verifyCode } from '../app/api/license/verify-code/route.ts';
import { POST as claim } from '../app/api/license/claim/route.ts';
import { POST as heartbeat } from '../app/api/cloud/heartbeat/route.ts';
import { POST as verify } from '../app/api/license/verify/route.ts';
import { POST as validate } from '../app/api/relay/validate/route.ts';
import { cascadeRootStatus, founderRoot, uniqueSiteName, MINTS_PER_DAY } from '../app/lib/founder.ts';
import { getLicenses, updateLicense } from '../app/lib/license-db.ts';

process.env.RELAY_MINT_SECRET = 'mint';
const hex = (c: string) => c.repeat(64);
let ip = 0;
const req = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://x' + url, { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': `10.0.0.${++ip % 250}`, ...headers }, body: JSON.stringify(body) });
const json = async (r: Response) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }) as any;

const F = 'roy@founder.test', P = 'pro@x.test';
const root = lic('root', F, { plan: 'founder', connector_limit: 0, expires_at: null, site_name: 'Home', claimed_by: hex('1'), claimed_hostname: 'hp', created_at: new Date(Date.now() - 100 * DAY).toISOString() });
const proSite = lic('pro1', P, { claimed_by: hex('9'), claimed_hostname: 'pro-box' });
seed(root, proSite);
put('sitestatus:root', { site_name: 'Home', controller_version: '1', devices: [], received_at: Date.now() - 5000 });

const link = async (email: string, cid: string, host: string) => {
  for (const k of [...kv.keys()]) if (k.startsWith('rl:verifycode')) kv.delete(k); // the code limit is tested elsewhere
  put('otp:' + email, { code: '123456', expires: Date.now() + 600000 });
  return json(await verifyCode(req('/api/license/verify-code', { email, code: '123456', controller_id: cid, hostname: host }) as any));
};
const doClaim = async (ticket: string, license_id: string, extra: Record<string, unknown> = {}) =>
  json(await claim(req('/api/license/claim', { ticket, license_id, ...extra }) as any));
const beat = async (token: string, cid: string) =>
  json(await heartbeat(req('/api/cloud/heartbeat', { site_name: 'x', devices: [{ name: 'u', state: 'online' }], controller_id: cid }, { authorization: 'Bearer ' + token }) as any));
const sitesOf = async (email: string) => (await getLicenses()).filter((l) => l.email === email && l.plan !== 'addon_connector');

console.log('pure helpers');
check('unique names: free name kept, taken name numbered, case-insensitive', uniqueSiteName('Acer', ['hp']) === 'Acer' && uniqueSiteName('acer', ['Acer', 'acer 2']) === 'acer 3');
check('founderRoot: only a running, non-minted founder licence counts',
  founderRoot(F, [root as any])?.id === 'root' && founderRoot(F, [{ ...root, status: 'revoked' } as any]) === null
  && founderRoot(F, [{ ...root, minted_from: 'x' } as any]) === null && founderRoot(F, [{ ...root, expires_at: new Date(Date.now() - 1000).toISOString() } as any]) === null
  && founderRoot(P, [proSite as any]) === null);

console.log('\nnon-founders keep the exact old behaviour');
let r = await link(P, hex('8'), 'pro-two');
check('a pro customer with no free site gets no "New site" choice', r.status === 200 && r.sites.length === 1 && !r.sites.some((s: any) => s.new || s.license_id === 'new'));
let c = await doClaim(r.ticket, 'new', { site_name: 'Sneaky' });
check('a pro customer cannot mint by sending license_id "new" (404, nothing created)', c.status === 404 && (await sitesOf(P)).length === 1);
// all sites of a pro customer revoked → still the old 409 no_site
await updateLicense('pro1', { status: 'revoked' });
r = await link(P, hex('8'), 'pro-two');
check('a pro customer without a running site still gets 409 no_site', r.status === 409 && r.error === 'no_site');
await updateLicense('pro1', { status: 'active' });

console.log('\nfounder links controller A (new site)');
const A = hex('a'), B = hex('b'), C = hex('c');
r = await link(F, A, 'acer');
const nw = r.sites.find((s: any) => s.new);
check('the founder is offered "New site" (state free, unlimited, never expires)', !!nw && nw.license_id === 'new' && nw.state === 'free' && nw.connector_limit === 0 && nw.expires_at === null && nw.plan === 'founder');
check('the existing founder site is still offered (in use → transferable)', r.sites.some((s: any) => s.license_id === 'root' && s.state === 'in_use' && s.can_transfer));
check('no token before the claim', !JSON.stringify(r).includes(root.token));
c = await doClaim(r.ticket, 'new', { site_name: '' });
const siteA = get(`license:${c.license_id}`);
check('claim "new" mints a site: plan founder, limit 0, never expires, bound to A, named after the hostname',
  c.status === 200 && !!c.token && c.plan === 'founder' && c.connector_limit === 0 && c.expires_at === null && c.site_name === 'acer'
  && siteA.minted_from === 'root' && siteA.claimed_by === A && siteA.status === 'active' && siteA.token === c.token);
check('the mint is in the audit log', [...kv.entries()].some(([k, v]) => k.startsWith('audit:') && JSON.parse(v).action === 'site.mint' && JSON.parse(v).license_id === siteA.id));
check('the ticket is single use (no second mint with it)', (await doClaim(r.ticket, 'new')).status === 401 && (await sitesOf(F)).length === 2);

console.log('\nfounder links controller B (new site, typed name, unique)');
r = await link(F, B, 'acer');
check('"New site" is offered again; A shows as in use', r.sites.some((s: any) => s.new) && r.sites.some((s: any) => s.license_id === siteA.id && s.state === 'in_use'));
c = await doClaim(r.ticket, 'new', { site_name: 'ACER' });
const siteB = get(`license:${c.license_id}`);
check('a name that is taken in this tenant gets a number', c.status === 200 && siteB.site_name === 'ACER 2' && siteB.claimed_by === B);
check('each controller has its own token', siteA.token !== siteB.token && siteB.token !== root.token);

console.log('\nheartbeats: licensed, unlimited, never underlicensed');
const hA = await beat(siteA.token, A), hB = await beat(siteB.token, B);
check('A and B heartbeat licensed with a lease', hA.status === 200 && hA.state === 'licensed' && !!hA.lease && hB.status === 200 && hB.state === 'licensed');
const leaseLimit = (l: string) => JSON.parse(Buffer.from(l.split('.')[0], 'base64url').toString()).connector_limit;
check('the lease carries connector_limit 0 (unlimited)', leaseLimit(hA.lease) === 0 && leaseLimit(hB.lease) === 0);
const v = await json(await verify(req('/api/license/verify', { license_key: siteA.token, connector_count: 5000 }) as any));
check('5000 connectors on a founder site: valid, not underlicensed', v.valid === true && v.status === 'valid' && v.connector_limit === 0);
check('relay accepts the minted site', (await json(await validate(req('/api/relay/validate', { token: siteA.token }, { 'X-Mint-Secret': 'mint' }) as any))).valid === true);

console.log('\nmigration: controller C takes over site A (transfer, not a new site)');
// After the controller migration C presents A's token: it is an unconfirmed copy until relinked.
const copy = await beat(siteA.token, C);
check('C on A\'s token is an unconfirmed copy first', copy.state === 'unconfirmed_copy');
r = await link(F, C, 'acer-new');
check('site A is suggested first for C (it carries A\'s token), "New site" still offered', r.sites[0].license_id === siteA.id && r.sites[0].suggested === true && r.sites.some((s: any) => s.new));
c = await doClaim(r.ticket, siteA.id, { transfer: true, acknowledge: true });
const aNow = get(`license:${siteA.id}`);
check('C takes over the SAME founder site with a new token; still founder, unlimited', c.status === 200 && c.license_id === siteA.id && aNow.claimed_by === C && c.token !== siteA.token && aNow.plan === 'founder' && c.connector_limit === 0);
check('no extra site was minted by the transfer', (await sitesOf(F)).length === 3);
check('A is retired with a capped lease', (await beat(siteA.token, A)).state === 'moved');
kv.delete(`sitestatus:${siteA.id}`); // the 15 s heartbeat throttle
check('C heartbeats licensed', (await beat(c.token, C)).state === 'licensed');
r = await link(F, A, 'acer');
check('a founder site may move again within 30 days (no cooldown for founders)', r.sites.find((s: any) => s.license_id === siteA.id)?.can_transfer === true);

console.log('\nrate limit');
let last: any;
for (let i = 0; i < MINTS_PER_DAY; i++) { r = await link(F, hex((i % 6 + 2).toString()), `bulk${i}`); last = await doClaim(r.ticket, 'new'); if (last.status !== 200) break; }
const count = (await sitesOf(F)).length;
check(`at most ${MINTS_PER_DAY} new sites per day`, last.status === 429 && last.error === 'mint_limit' && count === 1 + MINTS_PER_DAY, `${count} sites, last ${last.status}`);

console.log('\nrevoking the founder licence revokes every founder site');
const children = (await sitesOf(F)).filter((l) => l.minted_from === 'root');
await updateLicense(siteB.id, { status: 'revoked' }); // revoked by hand, before the root
await updateLicense('root', { status: 'revoked' });
// even before the cascade write, a child of a revoked root gets nothing
check('a child is denied as soon as the root is revoked (no cascade needed)', (await beat(c.token, C)).status === 403);
check('relay and legacy verify refuse a child of a revoked root',
  (await json(await validate(req('/api/relay/validate', { token: c.token }, { 'X-Mint-Secret': 'mint' }) as any))).valid === false
  && (await json(await verify(req('/api/license/verify', { license_key: c.token }) as any))).valid === false);
r = await link(F, hex('e'), 'new-box');
check('no "New site" and no founder sites offered once the root is revoked', r.status === 409 && r.error === 'no_site');
const followed = await cascadeRootStatus({ ...root, status: 'revoked' } as any, 'revoked', 'admin', updateLicense);
check('the cascade writes revoked to every running child (shown in admin/portal)', followed.length === children.length - 1 && (await sitesOf(F)).filter((l) => l.minted_from).every((l) => l.status === 'revoked'));
await updateLicense('root', { status: 'active' });
await cascadeRootStatus({ ...root, status: 'active' } as any, 'active', 'admin', updateLicense);
check('reactivating the root brings back the children it revoked, not the one revoked by hand',
  get(`license:${siteA.id}`).status === 'active' && get(`license:${siteB.id}`).status === 'revoked' && get(`license:${siteA.id}`).revoked_with_root === undefined);
check('a non-founder licence never cascades', (await cascadeRootStatus(proSite as any, 'revoked', 'admin', updateLicense)).length === 0);
done();
