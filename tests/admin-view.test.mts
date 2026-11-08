/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures are loosely typed on purpose */
// Admin console view model: the overview counts what the lists show, founder
// sites count as controllers of their founder license, and audit lines read as words.
import { check, done, lic, DAY } from './harness.mts';
import { buildTenants } from '../app/lib/tenants.ts';
import { licenseRows, licenseCounts, siteCounts, needsAttention, auditLine, checkIn } from '../app/admin/model.ts';

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const root = lic('root', 'founder@demo.example', { plan: 'founder', connector_limit: 0, site_name: 'HQ', claimed_by: 'c1' });
const kid1 = lic('kid1', 'founder@demo.example', { plan: 'founder', connector_limit: 0, site_name: 'Lab', minted_from: 'root', claimed_by: 'c2' });
const kid2 = lic('kid2', 'founder@demo.example', { plan: 'founder', connector_limit: 0, site_name: 'Old', minted_from: 'root', status: 'revoked' });
const bv = lic('bv', 'ops@demo-bv.example', { site_name: 'Demo BV', expires_at: iso(now + 5 * DAY), claimed_by: 'c3' });
const addon = lic('add', 'ops@demo-bv.example', { plan: 'addon_connector', parent_id: 'bv', connector_limit: 2, expires_at: iso(now + 60 * DAY) });
const gone = lic('gone', 'old@demo.example', { status: 'revoked', site_name: 'Gone' });
const ltd = lic('ltd', 'ltd@demo.example', { site_name: 'Ltd', expires_at: iso(now - 10 * DAY) });
const shop = lic('shop', 'shop@demo.example', { site_name: 'Shop', created_at: iso(now - 3 * DAY) });
const dev = (ups_status: string) => ({ name: 'UPS', state: 'online', version: '1', ups_status, battery_pct: 70, load_pct: 20, runtime_sec: 900, last_seen: 0 });
const statuses = new Map<string, any>([
  ['root', { site_name: 'HQ', controller_version: '1', devices: [dev('OL'), dev('OL')], received_at: now - 30_000 }],
  ['kid1', { site_name: 'Lab', controller_version: '1', devices: [dev('OL')], received_at: now - 3 * DAY }],
  ['bv', { site_name: 'Demo BV', controller_version: '1', devices: [dev('OB DISCHRG'), dev('OL')], received_at: now - 30_000 }],
]);
const tenants = buildTenants([], [root, kid1, kid2, bv, addon, gone, ltd, shop] as any, statuses, now);

const rows = licenseRows(tenants, now);
check('one row per license: founder sites and add-ons are not rows', rows.length === 5, String(rows.map((r) => r.id)));
const f = rows.find((r) => r.id === 'root')!;
check('founder: controllers used / unlimited (revoked founder site not counted)', f.controllers.used === 2 && f.controllers.limit === null, JSON.stringify(f.controllers));
check('founder: connectors over all its sites, unlimited', f.connectors.used === 3 && f.connectors.limit === 0);
check('founder: a revoke takes 1 running founder site with it', f.followers === 1);
const b = rows.find((r) => r.id === 'bv')!;
check('paid: limit includes running add-on', b.connectors.limit === 7 && b.controllers.limit === 1);
check('expiring status in plain words', b.status.label === 'Expires in 5 days', b.status.label);
check('expired status in plain words', rows.find((r) => r.id === 'ltd')!.status.label === 'Expired 10 days ago');

const c = licenseCounts(rows);
check('counts: active includes expiring', c.active === 3 && c.expiring === 1 && c.expired === 1 && c.revoked === 1, JSON.stringify(c));

const s = siteCounts(tenants, now);
check('sites: only running licenses count; offline and never connected split', s.total === 4 && s.online === 2 && s.offline === 1 && s.never === 1, JSON.stringify(s));

const att = needsAttention(tenants, now);
check('attention: on battery is first and urgent, with the real site name', att[0].level === 'critical' && att[0].title.startsWith('Demo BV'), att[0]?.title);
check('attention: offline founder site says for how long', att.some((a) => a.title === 'Lab offline for 3 days'));
check('attention: never connected shop has an action', att.some((a) => a.title === 'Shop never connected' && a.action));
check('attention: expiring license', att.some((a) => a.title === 'Demo BV: license expires in 5 days'));

check('check-in: linked controller without a stored check-in is offline, not never connected',
  checkIn([{ license: { ...ltd, claimed_by: 'x' }, status: null, online: false, addons: [], limit: 1, addonExtra: 0 } as any], now).label === 'Offline for over a week');

const a1 = auditLine({ at: iso(now), actor: 'admin@example.com', role: 'admin', action: 'license.update', email: 'ops@demo-bv.example', detail: JSON.stringify({ expires_at: '2026-12-05T10:00:00.000Z', connector_limit: 0 }) });
check('audit: JSON detail becomes words', a1.what === 'changed a license' && a1.detail === 'ends 05 Dec 2026 · unlimited connectors', a1.detail);
const a2 = auditLine({ at: iso(now), actor: 'controller', role: 'controller', action: 'copy.detected', detail: 'x' });
check('audit: controller entries read as "A controller"', a2.who === 'A controller' && a2.role === 'Controller');
check('audit: cascade reads as words', auditLine({ at: iso(now), actor: 'a', role: 'admin', action: 'license.revoke', detail: 'follows its founder licence 0f3c2a1b-1111-2222-3333-444455556666' }).detail === 'together with its founder license');
const a3 = auditLine({ at: iso(now), actor: 'founder@demo.example', role: 'owner', action: 'site.mint', detail: 'from 0f3c2a1b-1111-2222-3333-444455556666' });
check('audit: ids shortened', a3.detail === 'from 0f3c2a1b…' && a3.role === 'Customer', a3.detail);

done();
