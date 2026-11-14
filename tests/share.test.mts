// SHARE-1 (data model, not wired to routes yet): sharing ONE site by e-mail must cover exactly that site and nothing else.
// acme@test owns Acer + HP, shares Acer with colleague@test. mallory@test is another tenant.
// Run: npx tsx tests/share.test.mts
import { kv, put, seed, lic, check, done, DAY } from './harness.mts';
import { siteAccess, canManageLicence, sharedSites, inviteShare, acceptShare, revokeShare, INVITE_TTL_MS } from '../app/lib/shares.ts';
import { renameSite, releaseSite } from '../app/lib/site-actions.ts';

seed(
  lic('acer', 'acme@test', { site_name: 'Acer' }), lic('hp', 'acme@test', { site_name: 'HP' }),
  lic('acer-addon', 'acme@test', { plan: 'addon_connector', parent_id: 'acer' }),
  lic('mal', 'mallory@test', { site_name: 'Mal' }),
);

console.log('invite');
check('mallory cannot invite anyone to acme\'s Acer (not the owner) → 404', !(await inviteShare('mallory@test', 'acer', 'mallory@test', 'admin')).ok);
check('an add-on licence is not a site to share', !(await inviteShare('acme@test', 'acer-addon', 'colleague@test', 'viewer')).ok);
check('the owner cannot "share" with himself', !(await inviteShare('acme@test', 'acer', 'ACME@test', 'admin')).ok);
check('only viewer or admin', !(await inviteShare('acme@test', 'acer', 'colleague@test', 'owner')).ok);
const inv = await inviteShare('acme@test', 'acer', 'Colleague@Test', 'admin');
check('acme invites colleague@test to Acer as admin', inv.ok);
const token = inv.ok ? inv.value.token : '';
check('the invite token is stored only hashed', ![...kv.values()].some((v) => v.includes(token)));
check('an invited (not yet accepted) person has no access', (await siteAccess('colleague@test', 'acer')) === null);

console.log('\naccept');
check('another mailbox (mallory) cannot accept colleague\'s invite, even with the token', !(await acceptShare('mallory@test', 'acer', token)).ok);
check('the Acer token does not accept a share of HP', !(await acceptShare('colleague@test', 'hp', token)).ok);
check('a wrong token is refused', !(await acceptShare('colleague@test', 'acer', 'f'.repeat(64))).ok);
check('the invitee accepts with the right mailbox and token', (await acceptShare('colleague@test', 'acer', token)).ok);
check('the token works once', !(await acceptShare('colleague@test', 'acer', token)).ok);

console.log('\nexactly one site');
check('colleague: Acer as admin (via share)', JSON.stringify(await siteAccess('colleague@test', 'acer')) === JSON.stringify({ role: 'admin', via: 'share' }));
check('colleague shared Acer tries HP of the same owner → refused', (await siteAccess('colleague@test', 'hp')) === null);
check('colleague tries mallory\'s site → refused', (await siteAccess('colleague@test', 'mal')) === null);
check('colleague tries the add-on licence of Acer → refused', (await siteAccess('colleague@test', 'acer-addon')) === null);
check('"Shared with me" lists Acer only', JSON.stringify(await sharedSites('colleague@test')) === JSON.stringify([{ site_id: 'acer', role: 'admin' }]));
check('an admin share never manages the licence (billing, move, release, sharing)', (await canManageLicence('colleague@test', 'acer')) === false && (await canManageLicence('acme@test', 'acer')) === true);
check('…cannot re-share Acer', !(await inviteShare('colleague@test', 'acer', 'friend@test', 'viewer')).ok);
check('…cannot rename or release Acer through the owner actions (they stay owner-only)',
  !(await renameSite('acer', 'x', { email: 'colleague@test', role: 'owner' })).ok && !(await releaseSite('acer', { email: 'colleague@test', role: 'owner' })).ok);
check('owner of another org (mallory) on Acer → refused', (await siteAccess('mallory@test', 'acer')) === null);
check('mallory on her own site → owner (control)', (await siteAccess('mallory@test', 'mal'))?.role === 'owner');

console.log('\nrevoke, expiry, licence changes hands');
check('mallory cannot revoke acme\'s share', !(await revokeShare('mallory@test', 'acer', 'colleague@test')).ok && (await siteAccess('colleague@test', 'acer')) !== null);
check('acme revokes the share', (await revokeShare('acme@test', 'acer', 'colleague@test')).ok);
check('revoked colleague → refused', (await siteAccess('colleague@test', 'acer')) === null && (await sharedSites('colleague@test')).length === 0);
check('a revoked share cannot be re-accepted with the old token', !(await acceptShare('colleague@test', 'acer', token)).ok);

const v = await inviteShare('acme@test', 'hp', 'viewer@test', 'viewer', { expires_at: new Date(Date.now() + DAY).toISOString() });
await acceptShare('viewer@test', 'hp', v.ok ? v.value.token : '');
check('a share with an end date works before it', (await siteAccess('viewer@test', 'hp'))?.role === 'viewer');
check('…and decides nothing after it', (await siteAccess('viewer@test', 'hp', Date.now() + 2 * DAY)) === null);
const late = await inviteShare('acme@test', 'hp', 'late@test', 'viewer');
check('an invite not accepted within 7 days expires', !(await acceptShare('late@test', 'hp', late.ok ? late.value.token : '', Date.now() + INVITE_TTL_MS + 1)).ok);
put('license:hp', lic('hp', 'beurs@test', { site_name: 'HP' }));
check('the licence moved to another owner: the old owner\'s shares die with it', (await siteAccess('viewer@test', 'hp')) === null);
put('license:acer', { ...lic('acer', 'acme@test'), status: 'revoked' });
check('a revoked licence gives nobody access, not even its owner', (await siteAccess('acme@test', 'acer')) === null);

done();
