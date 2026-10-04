import { kv, mails, put, get, seed, lic, check, done, DAY, PUBKEY } from './harness.mts';
import { signLease, verifyLease } from '../app/lib/lease.ts';
import { decideHeartbeat } from '../app/lib/sitelink.ts';
import { POST as verifyCode } from '../app/api/license/verify-code/route.ts';
import { POST as claim } from '../app/api/license/claim/route.ts';
import { POST as heartbeat } from '../app/api/cloud/heartbeat/route.ts';

const CTRL_A = 'a'.repeat(64), CTRL_B = 'b'.repeat(64), CTRL_C = 'c'.repeat(64);
const req = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://x' + url, { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '9.9.9.9', ...headers }, body: JSON.stringify(body) });
const json = async (r: Response) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }) as any;
const now = () => Math.floor(Date.now() / 1000);

console.log('lease signature');
const p = { v: 1 as const, license_id: 'L', controller_id: CTRL_A, plan: 'pro', connector_limit: 5, issued_at: now(), valid_until: now() + 100, site_name: 'X', state: 'licensed' as const };
const tok = (await signLease(p))!;
check('signed lease verifies and carries its fields', (await verifyLease(tok, PUBKEY))?.license_id === 'L');
const [b, s] = tok.split('.');
const forged = Buffer.from(JSON.stringify({ ...p, valid_until: now() + 99999999 })).toString('base64url') + '.' + s;
check('a lease with a changed end date is rejected', (await verifyLease(forged, PUBKEY)) === null);
check('garbage is rejected', (await verifyLease('nope', PUBKEY)) === null && (await verifyLease(b + '.AAAA', PUBKEY)) === null);

console.log('\nheartbeat roles (pure rules)');
const L = lic('s1', 'c@x.nl', { claimed_by: CTRL_A });
const T = L.token;
check('holder', decideHeartbeat(L as any, T, CTRL_A, now()).kind === 'holder');
check('legacy controller without hardware ID is a holder', (decideHeartbeat(L as any, T, undefined, now()) as any).legacy === true);
check('first heartbeat with an ID adopts an unclaimed license', (decideHeartbeat({ ...L, claimed_by: undefined } as any, T, CTRL_A, now()) as any).adopt === true);
const copy = decideHeartbeat(L as any, T, CTRL_B, now()) as any;
check('another controller on the same token is an unconfirmed copy, 30-day lease', copy.kind === 'copy' && copy.isNew && copy.leaseUntil - now() > 29 * 86400 && copy.leaseUntil - now() <= 30 * 86400);
const old = { ...L, copies: [{ controller_id: CTRL_B, hostname: 'h', first_seen: new Date(Date.now() - 31 * DAY).toISOString() }] };
check('a copy older than 30 days is denied', (decideHeartbeat(old as any, T, CTRL_B, now()) as any).error === 'copy_expired');
check('a removed copy is denied at once', (decideHeartbeat({ ...L, copies: [{ controller_id: CTRL_B, hostname: '', first_seen: new Date().toISOString(), decision: 'removed' }] } as any, T, CTRL_B, now()) as any).error === 'copy_removed');
check('revoked and expired are denied', (decideHeartbeat({ ...L, status: 'revoked' } as any, T, CTRL_A, now()) as any).error === 'revoked' && (decideHeartbeat({ ...L, expires_at: new Date(Date.now() - 1000).toISOString() } as any, T, CTRL_A, now()) as any).error === 'expired');
const shortExp = decideHeartbeat({ ...L, expires_at: new Date(Date.now() + 5 * DAY).toISOString() } as any, T, CTRL_A, now()) as any;
check('a lease never outlives the license', shortExp.leaseUntil - now() <= 5 * 86400);
const ret = { ...L, token: 'new-token', retired: [{ controller_id: CTRL_A, token: T, until: new Date(Date.now() + 10 * DAY).toISOString(), reason: 'moved', at: new Date().toISOString() }] };
const rd = decideHeartbeat(ret as any, T, CTRL_A, now()) as any;
check('a retired controller keeps a lease capped at its end date', rd.kind === 'retired' && rd.leaseUntil - now() <= 10 * 86400 && rd.leaseUntil - now() > 9 * 86400);
check('a retired controller whose time is over is denied', (decideHeartbeat({ ...ret, retired: [{ ...ret.retired[0], until: new Date(Date.now() - 1000).toISOString() }] } as any, T, CTRL_A, now()) as any).error === 'retired');

console.log('\nlinking through the API');
const E = 'cust@x.nl';
const free = lic('free1', E, { created_at: new Date(Date.now() - 30 * DAY).toISOString() });
const rot = lic('rot1', E, { claimed_by: CTRL_B, claimed_hostname: 'nanopi-r3s', claimed_at: new Date(Date.now() - 40 * DAY).toISOString(), site_name: 'Rotterdam', created_at: new Date(Date.now() - 50 * DAY).toISOString() });
const rev = lic('rev1', E, { status: 'revoked' });
seed(free, rot, rev);
put('sitestatus:rot1', { site_name: 'Rotterdam', controller_version: '1', devices: [], received_at: Date.now() - 5000 });
const otp = () => put('otp:' + E, { code: '123456', expires: Date.now() + 600000 });

otp();
let r = await json(await verifyCode(req('/api/license/verify-code', { email: E, code: '000000', controller_id: CTRL_A }) as any));
check('wrong code is refused', r.status === 401);
otp();
r = await json(await verifyCode(req('/api/license/verify-code', { email: E, code: '123456', controller_id: CTRL_A, hostname: 'rpi-new' }) as any));
check('right code returns a ticket and the sites, and NO token', r.valid && !!r.ticket && Array.isArray(r.sites) && !JSON.stringify(r).includes(free.token) && !JSON.stringify(r).includes(rot.token));
check('the unassigned license is listed first, a site in use is marked transferable, revoked is hidden',
  r.sites[0].license_id === 'free1' && r.sites[0].state === 'free' && r.sites[1].state === 'in_use' && r.sites[1].can_transfer === true && r.sites.length === 2);
check('the holder is described for the warning', r.sites[1].holder?.hostname === 'nanopi-r3s' && r.sites[1].holder?.online === true);
const ticket = r.ticket;

let c = await json(await claim(req('/api/license/claim', { ticket, license_id: 'rot1' }) as any));
check('taking a site that is in use without confirmation is refused', c.status === 409 && c.error === 'needs_transfer');
c = await json(await claim(req('/api/license/claim', { ticket, license_id: 'rev1' }) as any));
check('a revoked site cannot be claimed', c.status === 409);
c = await json(await claim(req('/api/license/claim', { ticket, license_id: 'free1', site_name: '  Utrecht\u0000  ' }) as any));
check('claiming the free site returns token, lease and the clean name', c.status === 200 && c.token === free.token && c.site_name === 'Utrecht' && (await verifyLease(c.lease, PUBKEY))?.controller_id === CTRL_A);
check('the license now belongs to that controller', get('license:free1').claimed_by === CTRL_A);
c = await json(await claim(req('/api/license/claim', { ticket, license_id: 'free1' }) as any));
check('the ticket is single use', c.status === 401);

otp();
r = await json(await verifyCode(req('/api/license/verify-code', { email: E, code: '123456', controller_id: CTRL_A }) as any));
check('the same controller sees its site as "yours" (relinking keeps working)', r.sites.some((x: any) => x.license_id === 'free1' && x.state === 'yours'));
c = await json(await claim(req('/api/license/claim', { ticket: r.ticket, license_id: 'free1' }) as any));
check('relinking returns the same token', c.status === 200 && c.token === free.token);

console.log('\ntransfer');
otp();
r = await json(await verifyCode(req('/api/license/verify-code', { email: E, code: '123456', controller_id: CTRL_C, hostname: 'rpi-c' }) as any));
c = await json(await claim(req('/api/license/claim', { ticket: r.ticket, license_id: 'rot1', transfer: true, acknowledge: false }) as any));
check('transfer needs the acknowledgement as well', c.status === 409);
mails.length = 0;
c = await json(await claim(req('/api/license/claim', { ticket: r.ticket, license_id: 'rot1', transfer: true, acknowledge: true }) as any));
const after = get('license:rot1');
check('transfer works, the new controller gets a NEW token', c.status === 200 && c.token !== rot.token && after.token === c.token && after.claimed_by === CTRL_C);
check('the old holder is retired for 30 days on its old token', after.retired?.length === 1 && after.retired[0].controller_id === CTRL_B && after.retired[0].token === rot.token && new Date(after.retired[0].until).getTime() - Date.now() > 29 * DAY);
check('the owner is told by e-mail, with the date', mails.some((m) => m.to === E && /moved/.test(m.subject)) );
check('the old token still resolves (so the old controller can be recognised)', kv.has('index:token:' + rot.token.toLowerCase()));
const oldHb = await json(await heartbeat(req('/api/cloud/heartbeat', { site_name: 'x', devices: [], controller_id: CTRL_B }, { authorization: 'Bearer ' + rot.token }) as any));
check('the old controller gets a capped lease and a notice, not an error', oldHb.status === 200 && oldHb.state === 'moved' && /moved/.test(oldHb.notice) && oldHb.lease_valid_until - now() <= 30 * 86400);

otp();
const CTRL_D = 'd'.repeat(64);
r = await json(await verifyCode(req('/api/license/verify-code', { email: E, code: '123456', controller_id: CTRL_D }) as any));
const rotNow = r.sites.find((x: any) => x.license_id === 'rot1');
check('a third controller cannot move it again within 30 days, and is told how long', rotNow.can_transfer === false && /can move again in \d+ days?/.test(rotNow.transfer_blocked));
c = await json(await claim(req('/api/license/claim', { ticket: r.ticket, license_id: 'rot1', transfer: true, acknowledge: true }) as any));
check('and the claim itself is refused too (cooldown)', c.status === 429);
otp();
r = await json(await verifyCode(req('/api/license/verify-code', { email: E, code: '123456', controller_id: CTRL_B }) as any));
check('the controller that was just replaced is offered the undo straight away', r.sites.find((x: any) => x.license_id === 'rot1').can_transfer === true);
c = await json(await claim(req('/api/license/claim', { ticket: r.ticket, license_id: 'rot1', transfer: true, acknowledge: true }) as any));
check('…but the controller that was just replaced may undo it within the hour', c.status === 200 && get('license:rot1').claimed_by === CTRL_B);
const hbC = await json(await heartbeat(req('/api/cloud/heartbeat', { site_name: 'x', devices: [], controller_id: CTRL_C }, { authorization: 'Bearer ' + after.token }) as any));
check('after the undo the taker is retired at once', hbC.status === 403 && hbC.error === 'retired');

console.log('\ncopy detection through the heartbeat');
mails.length = 0;
const cur = get('license:free1');
const cp = await json(await heartbeat(req('/api/cloud/heartbeat', { site_name: 'x', devices: [], controller_id: CTRL_C, hostname: 'clone' }, { authorization: 'Bearer ' + cur.token }) as any));
check('a copy gets a lease capped at 30 days and a clear notice', cp.status === 200 && cp.state === 'unconfirmed_copy' && /copy/.test(cp.notice));
check('the copy is recorded once, the owner is mailed', get('license:free1').copies?.length === 1 && mails.filter((m) => /copy/i.test(m.subject)).length === 1);
await heartbeat(req('/api/cloud/heartbeat', { site_name: 'x', devices: [], controller_id: CTRL_C, hostname: 'clone' }, { authorization: 'Bearer ' + cur.token }) as any);
check('a second heartbeat does not create a second record or mail', get('license:free1').copies?.length === 1 && mails.filter((m) => /copy/i.test(m.subject)).length === 1);
const own = await json(await heartbeat(req('/api/cloud/heartbeat', { site_name: 'Utrecht', devices: [], controller_id: CTRL_A, hostname: 'rpi-new' }, { authorization: 'Bearer ' + cur.token }) as any));
check('the real holder is unaffected and gets a verifiable lease', own.status === 200 && own.state === 'licensed' && (await verifyLease(own.lease, PUBKEY))?.valid_until === own.lease_valid_until);
check('a copy never overwrites the holder\'s data', get('sitestatus:free1')?.site_name === 'Utrecht');

console.log('\nlegacy controllers keep working');
const leg = lic('leg1', 'old@x.nl'); seed(leg);
const lh = await json(await heartbeat(req('/api/cloud/heartbeat', { site_name: 'Old', devices: [] }, { authorization: 'Bearer ' + leg.token }) as any));
check('a controller without a hardware ID still gets 200 and a lease', lh.status === 200 && !!lh.lease && get('license:leg1').claimed_by === undefined);
otp(); put('otp:old@x.nl', { code: '123456', expires: Date.now() + 600000 });
const lv = await json(await verifyCode(req('/api/license/verify-code', { email: 'old@x.nl', code: '123456' }) as any));
check('the old link flow (no hardware ID) still returns the token directly', lv.valid && lv.token === leg.token);
done();
