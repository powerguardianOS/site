// ACCOUNT-UI: the account page's view model — one card per site with its license, unused licenses apart, no internal names.
// Run: npx tsx tests/account-view.test.mts
import { lic, check, done, DAY } from './harness.mts';

const { accountView, siteName, connectorsText, termText, inUse } = await import('../app/lib/account-view.ts');
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
check('the license travels with its site (plan on the card)', v.sites[0].license.plan === 'founder' && v.sites[0].license.connectors === '1 connector · unlimited' && v.sites[0].name === 'Thuis');
check('online state per site', v.sites[0].online === true && v.sites[1].online === false);
check('a license no controller holds goes to “not in use”', v.unused.length === 1 && v.unused[0].id === 'spare');
check('connector add-ons are neither sites nor unused licenses', !v.sites.some((s) => s.license.id === 'addon') && !v.unused.some((l) => l.id === 'addon'));
check('no “default-site” in any card name', !v.sites.some((s) => /default-site/.test(s.name)));
check('only display data: no token, e-mail, site_id, LAN or the controller’s own site_name', !/tok-|roy@x\\.nl|site_id|default-site|"lan"|claimed_by/.test(JSON.stringify(v)), JSON.stringify(v).slice(0, 200));
check('a license that reported before hardware IDs (no claimed_by) is in use', inUse(spare, st()) && !inUse(spare, null));

console.log('\nsummary chips');
check('“2 sites · 1 online · 1 offline · Founder · 1 license not in use”', v.chips.join(' · ') === '2 sites · 1 online · 1 offline · Founder · 1 license not in use', v.chips.join(' · '));
const v2 = accountView([{ lic: thuis, status: st() }, { lic: { ...spare, claimed_by: 'c'.repeat(64) }, status: st() }], all, now);
check('all online, plans in order Founder, Pro', v2.chips.join(' · ') === '2 sites · 2 online · Founder · Pro', v2.chips.join(' · '));
check('no licenses: no chips (no empty box)', accountView([], [], now).chips.length === 0);

console.log('\nlicense facts on the card');
check('unlimited', connectorsText(thuis, all, 1) === '1 connector · unlimited' && connectorsText(thuis, all, null) === 'Unlimited connectors');
check('capacity includes running add-ons', connectorsText(spare, all, 2) === '2 of 8 connectors' && connectorsText(spare, all, null) === 'Up to 8 connectors');
check('term', termText(thuis) === 'Never expires' && termText({ ...spare, expires_at: new Date(now + 30 * DAY).toISOString() }).startsWith('Valid until '));

console.log('\nthe page never renders the internal site_id or hostnames as names');
const fs = await import('node:fs');
const src = ['app/account/page.tsx', 'app/account/components/SitesSection.tsx'].map((f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
check('site_id is never read by the page', !/\.site_id\b/.test(src));
check('the card title comes from siteName (account-view), not hostname', /site-name[^>]*>\{name\}/.test(src) && !/claimed_hostname\s*\?\?\s*['"]/.test(src));

done();
