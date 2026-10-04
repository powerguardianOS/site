import { kv, mails, put, get, seed, lic, check, done, DAY, PUBKEY } from './harness.mts';
import { renameSite, replaceWithCopy, keepCopy, removeCopy, releaseSite, issueOfflineLease, setSiteFlags } from '../app/lib/site-actions.ts';
import { decideHeartbeat } from '../app/lib/sitelink.ts';
import { verifyLease } from '../app/lib/lease.ts';
import { listAudit } from '../app/lib/audit.ts';

const A = 'a'.repeat(64), B = 'b'.repeat(64), E = 'e'.repeat(64);
const owner = { email: 'cust@x.nl', role: 'owner' as const };
const other = { email: 'someone@else.nl', role: 'owner' as const };
const admin = { email: 'admin@powerguardian.cloud', role: 'admin' as const };
const now = () => Math.floor(Date.now() / 1000);

const site = lic('s1', 'cust@x.nl', { claimed_by: A, claimed_hostname: 'nanopi', site_name: 'Rotterdam', copies: [{ controller_id: B, hostname: 'rpi-new', first_seen: new Date().toISOString() }] });
const spare = lic('s2', 'cust@x.nl');
seed(site, spare);
put('sitestatus:s1', { site_name: 'Rotterdam', controller_version: '1', devices: [], received_at: Date.now() });

console.log('ownership');
check('another account cannot touch the site (looks like it does not exist)', (await renameSite('s1', 'Hacked', other) as any).status === 404 && get('license:s1').site_name === 'Rotterdam');
check('the owner can rename it', (await renameSite('s1', ' Rotterdam Zuid ', owner)).ok && get('license:s1').site_name === 'Rotterdam Zuid');
check('an empty name is refused', (await renameSite('s1', '   ', owner) as any).error === 'name_required');
check('an add-on id is not a site', (await renameSite('nope', 'x', owner) as any).status === 404);

console.log('\nreplace');
const bad = await replaceWithCopy('s1', 'c'.repeat(64), owner) as any;
check('an unknown copy is refused', bad.error === 'copy_not_found');
mails.length = 0;
const rp = await replaceWithCopy('s1', B, owner);
const s1 = get('license:s1');
check('replacing moves the site to the copy and retires the old controller at once', rp.ok && s1.claimed_by === B && s1.retired?.[0]?.controller_id === A && s1.retired[0].reason === 'replaced' && new Date(s1.retired[0].until).getTime() <= Date.now());
check('the copy record is cleared', (s1.copies ?? []).length === 0);
check('the old controller is denied at its next heartbeat, the new one is the holder', (decideHeartbeat(s1, s1.token, A, now()) as any).error === 'retired' && decideHeartbeat(s1, s1.token, B, now()).kind === 'holder');
check('the owner is mailed', mails.some((m) => /replaced/.test(m.subject)));

console.log('\nkeep both / remove');
put('license:s1', { ...get('license:s1'), copies: [{ controller_id: E, hostname: 'x', first_seen: new Date().toISOString() }] });
const keep = await keepCopy('s1', E, owner);
check('keep both works while a free site license exists', keep.ok && get('license:s1').copies[0].decision === 'relink');
put('license:s2', { ...get('license:s2'), claimed_by: 'f'.repeat(64) });
check('keep both is refused when there is no unassigned license, with the way out', (await keepCopy('s1', E, owner) as any).error === 'no_free_site');
check('remove switches the copy off', (await removeCopy('s1', E, owner)).ok && (decideHeartbeat(get('license:s1'), get('license:s1').token, E, now()) as any).error === 'copy_removed');

console.log('\nrelease');
const before = get('license:s1');
const rel = await releaseSite('s1', owner);
const rl = get('license:s1');
check('release frees the site, rotates the token and drops the stale status', rel.ok && rl.claimed_by === undefined && rl.token !== before.token && !kv.has('sitestatus:s1'));
check('the released controller is retired at once (by id, and by the old token)', (decideHeartbeat(rl, before.token, B, now()) as any).error === 'retired');
check('an admin may release too', (await releaseSite('s2', admin)).ok);

console.log('\noffline lease');
put('license:s1', { ...get('license:s1'), claimed_by: undefined, offline_allowed: false });
check('refused unless the admin approved it', (await issueOfflineLease('s1', A, owner) as any).error === 'not_allowed');
check('the admin can approve it', (await setSiteFlags('s1', { offline_allowed: true }, admin)).ok && get('license:s1').offline_allowed === true);
check('a malformed controller ID is refused', (await issueOfflineLease('s1', 'abc', owner) as any).error === 'bad_controller_id');
const off = await issueOfflineLease('s1', A, owner) as any;
const payload = await verifyLease(off.value.lease, PUBKEY);
check('a signed 12-month lease bound to that controller', off.ok && payload?.offline === true && payload.controller_id === A && payload.valid_until - now() > 364 * 86400 && payload.valid_until - now() <= 365 * 86400);
put('license:s1', { ...get('license:s1'), claimed_by: B });
check('not for a controller other than the one the site is linked to', (await issueOfflineLease('s1', A, owner) as any).error === 'wrong_controller');
put('license:s1', { ...get('license:s1'), claimed_by: undefined, expires_at: new Date(Date.now() + 10 * DAY).toISOString() });
const short = await issueOfflineLease('s1', A, owner) as any;
check('an offline lease never outlives the license', (await verifyLease(short.value.lease, PUBKEY))!.valid_until - now() <= 10 * 86400);

console.log('\naudit trail');
const log = await listAudit(50);
const actions = log.map((x) => x.action);
check('every action was logged, newest first', ['site.rename', 'copy.replace', 'copy.keep', 'copy.remove', 'site.release', 'lease.offline'].every((a) => actions.includes(a)) && new Date(log[0].at) >= new Date(log[log.length - 1].at));
check('entries say who did it', log.some((x) => x.actor === 'admin@powerguardian.cloud' && x.role === 'admin') && log.some((x) => x.role === 'owner'));
done();
