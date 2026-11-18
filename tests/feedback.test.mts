// FEEDBACK-1: the controller API (license token), the website API (session), the admin actions, and the key layout the
// nightly read uses. Negative cases first-class: bad token, size cap, validation, daily limit, cross-origin, and one
// account never sees another's items through either API.
// Run: npx tsx tests/feedback.test.mts      (KV_BACKEND=d1: the same against D1)
import { kv, get, seed, lic, check, done } from './harness.mts';
import { createSession } from '../app/lib/session.ts';

const ctl = await import('../app/api/cloud/feedback/route.ts');
const acct = await import('../app/api/account/feedback/route.ts');
const { POST: adminPost } = await import('../app/api/admin/feedback/route.ts');
const { adminRows, listAll, rootOf, parseFeedback } = await import('../app/lib/feedback.ts');
const { listAudit } = await import('../app/lib/audit.ts');

const SITE = 'https://powerguardian.cloud';
const A = lic('site-a', 'Anna@A.test'), A2 = lic('site-a2', 'anna@a.test'), B = lic('site-b', 'bob@b.test');
const REVOKED = lic('site-r', 'rex@r.test', { status: 'revoked' });
const EXPIRED = lic('site-x', 'xena@x.test', { expires_at: new Date(Date.now() - 1000).toISOString() });
const HOLDER = 'c'.repeat(64), COPY = 'e'.repeat(64), OLD = 'd'.repeat(64);
const CLAIMED = lic('site-c', 'cleo@c.test', {
  claimed_by: HOLDER, copies: [{ controller_id: COPY, hostname: 'copy', first_seen: new Date().toISOString() }],
  retired: [{ controller_id: OLD, token: null, until: new Date(Date.now() + 5 * 86_400_000).toISOString(), reason: 'moved', at: new Date().toISOString() }],
});
seed(A, A2, B, REVOKED, EXPIRED, CLAIMED);

const json = async (r: Response) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }) as any;
const cHdr = (token: string | null, cid?: string): Record<string, string> => ({ ...(token ? { authorization: 'Bearer ' + token } : {}), ...(cid ? { 'x-controller-id': cid } : {}) });
const cPost = (token: string | null, body: unknown, cid?: string) => ctl.POST(new Request(SITE + '/api/cloud/feedback', {
  method: 'POST', headers: { 'content-type': 'application/json', ...cHdr(token, cid) }, body: typeof body === 'string' ? body : JSON.stringify(body),
}));
const cGet = (token: string | null, cid?: string) => ctl.GET(new Request(SITE + '/api/cloud/feedback', { headers: cHdr(token, cid) }));
const aReq = (cookie: string | null, body?: unknown, o: { origin?: string | null; ct?: string } = {}) => {
  const h: Record<string, string> = cookie ? { cookie: 'pg_session=' + cookie } : {};
  if (body !== undefined) { h['content-type'] = o.ct ?? 'application/json'; if (o.origin !== null) h.origin = o.origin ?? SITE; }
  return new Request(SITE + '/api/account/feedback', body === undefined ? { headers: h } : { method: 'POST', headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) });
};
const aPost = (cookie: string | null, body: unknown, o = {}) => acct.POST(aReq(cookie, body, o));
const aGet = (cookie: string | null) => acct.GET(aReq(cookie));
const admin = (cookie: string | null, body: unknown, origin: string | null = SITE) => adminPost(new Request(SITE + '/api/admin/feedback', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie: 'pg_session=' + cookie } : {}), ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
}));
const good = (o: Record<string, unknown> = {}) => ({ kind: 'bug', text: 'The NAS did not wake up after the power came back.', version: '0.1.120', ...o });
const items = () => [...kv.keys()].filter((k) => k.startsWith('feedback:item:'));

console.log('controller: POST and GET with the license token');
let r = await json(await cPost(A.token, good({ report_id: 'PGR-ABCD-EFGH' })));
const first = get(`feedback:item:${r.id}`);
check('a valid report → 200 {id}', r.status === 200 && /^[0-9a-f]{16}$/.test(r.id));
check('stored as JSON under feedback:item:<id>, for the license owner (lower case)', first?.kind === 'bug' && first.email === 'anna@a.test' && first.status === 'new' && first.license_id === A.id && first.source === 'controller');
check('version and report_id are kept (the id only)', first.version === '0.1.120' && first.report_id === 'PGR-ABCD-EFGH');
check('and indexed under feedback:acct:<email>:<inverted time>:<id>', [...kv.keys()].some((k) => /^feedback:acct:anna%40a\.test:\d{13}:/.test(k) && k.endsWith(':' + r.id)));
r = await json(await cPost(A.token, good({ kind: 'idea', text: '  Dark mode for the logbook  ', version: '0.1.120' })));
const ideaA = r.id;
let g = await json(await cGet(A.token));
check('GET → the account\'s items, newest first', g.status === 200 && g.items.length === 2 && g.items[0].id === ideaA && g.items[0].text === 'Dark mode for the logbook');
check('…in the agreed shape (id, kind, text, status, created_at, replies), no e-mail or license in it',
  Object.keys(g.items[0]).sort().join() === 'created_at,id,kind,replies,status,text' && typeof g.items[0].created_at === 'number' && Array.isArray(g.items[0].replies));
check('a second site of the same owner sees the same account', (await json(await cGet(A2.token))).items.length === 2);

console.log('controller: authentication');
check('no token → 401', (await cPost(null, good())).status === 401 && (await cGet(null)).status === 401);
check('a made-up token → 401', (await cPost('tok-nope-' + 'b'.repeat(20), good())).status === 401 && (await cGet('deadbeef')).status === 401);
check('a revoked license → 403', (await cPost(REVOKED.token, good())).status === 403 && (await cGet(REVOKED.token)).status === 403);
check('an expired license → 403', (await cPost(EXPIRED.token, good())).status === 403);
check('the site\'s own controller (its hardware ID) → 200', (await cGet(CLAIMED.token, HOLDER)).status === 200);
check('a copy of the site (same token, other hardware ID) → 403, POST and GET', (await cPost(CLAIMED.token, good(), COPY)).status === 403 && (await cGet(CLAIMED.token, COPY)).status === 403);
check('a retired controller (the site moved away from it) → 403', (await cPost(CLAIMED.token, good(), OLD)).status === 403 && (await cGet(CLAIMED.token, OLD)).status === 403);
check('an unknown hardware ID on a claimed site (a new copy) → 403', (await cPost(CLAIMED.token, good(), 'f'.repeat(64))).status === 403);
check('…nothing stored for any of them', items().length === 2);

console.log('controller: validation and size');
for (const [label, body, field] of [
  ['kind missing', good({ kind: undefined }), 'kind'],
  ['kind "feature"', good({ kind: 'feature' }), 'kind'],
  ['kind as an array', good({ kind: ['bug'] }), 'kind'],
  ['empty text', good({ text: '   ' }), 'text'],
  ['text over 4000', good({ text: 'x'.repeat(4001) }), 'text'],
  ['text as an object', good({ text: { a: 1 } }), 'text'],
  ['no version from a controller', good({ version: undefined }), 'version'],
  ['version over 32', good({ version: '1'.repeat(33) }), 'version'],
  ['version with markup', good({ version: '<b>1</b>' }), 'version'],
  ['report_id with a slash', good({ report_id: '../etc' }), 'report_id'],
  ['report_id over 64', good({ report_id: 'a'.repeat(65) }), 'report_id'],
] as const) {
  r = await json(await cPost(A.token, body));
  check(`${label} → 400 (${field})`, r.status === 400 && r.field === field, JSON.stringify(r));
}
check('exactly 4000 characters is fine', parseFeedback(good({ text: 'y'.repeat(4000) }), true).ok);
check('garbage JSON → 400', (await cPost(A.token, '{nope')).status === 400);
check('a body over 16 KB → 413', (await cPost(A.token, good({ text: 'z'.repeat(17_000) }))).status === 413);
let pulled = 0;
const endless = new ReadableStream<Uint8Array>({ pull(c) { pulled++; c.enqueue(new TextEncoder().encode('x'.repeat(1024))); } });
const chunked = new Request(SITE + '/api/cloud/feedback', { method: 'POST', headers: { authorization: 'Bearer ' + A.token }, body: endless, duplex: 'half' } as RequestInit);
check('a chunked body is cut off at 16 KB → 413 (not read to the end)', (await ctl.POST(chunked)).status === 413 && pulled <= 20, String(pulled));
check('…none of them stored anything', items().length === 2);
r = await json(await cPost(A.token, good({ text: 'line one\r\nline two\u0000\u0007' })));
check('line breaks stay, other control characters go', get(`feedback:item:${r.id}`).text === 'line one\nline two');

console.log('controller: 10 per license per 24 h');
const st: number[] = [];
for (let i = 0; i < 8; i++) st.push((await cPost(A.token, good({ text: 'flood ' + i }))).status);
check('3 sent before + 7 more → the 11th of the day is refused', st.slice(0, 7).every((s) => s === 200) && st[7] === 429, st.join());
r = await json(await cPost(A.token, good()));
check('→ 429 {"error":"rate_limited"}', r.status === 429 && r.error === 'rate_limited');
check('another license of the same owner has its own limit', (await cPost(A2.token, good({ text: 'from the second site' }))).status === 200);

console.log('website: /api/account/feedback');
const anna = await createSession('anna@a.test'), bob = await createSession('bob@b.test');
check('no session → 401', (await aPost(null, good())).status === 401 && (await aGet(null)).status === 401);
check('a made-up session → 401', (await aGet('f'.repeat(64))).status === 401);
check('cross-origin POST → 403', (await aPost(bob, good(), { origin: 'https://evil.example' })).status === 403);
check('POST without an Origin → 403', (await aPost(bob, good(), { origin: null })).status === 403);
check('a form post (not JSON) → 415', (await aPost(bob, 'kind=bug&text=x', { ct: 'application/x-www-form-urlencoded' })).status === 415);
r = await json(await aPost(bob, { kind: 'idea', text: 'Export the logbook as CSV', report_id: 'PGR-SNEAKY' }));
const bobIdea = get(`feedback:item:${r.id}`);
check('a signed-in POST without version → 200', r.status === 200 && bobIdea.email === 'bob@b.test' && bobIdea.source === 'web' && !bobIdea.version);
check('…a report_id from the website is ignored (only a controller sends reports)', !('report_id' in bobIdea));
check('kind is checked here too', (await json(await aPost(bob, { kind: 'rant', text: 'x' }))).field === 'kind');
check('size cap here too → 413', (await aPost(bob, { kind: 'bug', text: 'z'.repeat(17_000) })).status === 413);
const bst: number[] = [];
for (let i = 0; i < 10; i++) bst.push((await aPost(bob, { kind: 'bug', text: 'b' + i })).status);
check('10 per account per 24 h, then 429', bst.slice(0, 9).every((s) => s === 200) && bst[9] === 429, bst.join());
const bobBug = (await json(await aGet(bob))).items.find((x: any) => x.text === 'b0').id;

console.log('isolation');
const annaWeb = await json(await aGet(anna)), bobWeb = await json(await aGet(bob)), annaCtl = await json(await cGet(A.token)), bobCtl = await json(await cGet(B.token));
const ids = (x: any) => new Set(x.items.map((i: any) => i.id));
check('the website shows Anna the items her controllers sent', annaWeb.items.some((i: any) => i.id === ideaA));
check('Anna never sees Bob\'s items (website)', ![...ids(annaWeb)].some((id) => ids(bobWeb).has(id)) && !annaWeb.items.some((i: any) => i.id === bobIdea.id));
check('…nor through her controller', !annaCtl.items.some((i: any) => ids(bobWeb).has(i.id)));
check('Bob\'s controller sees only Bob\'s items', bobCtl.items.every((i: any) => ids(bobWeb).has(i.id)) && !bobCtl.items.some((i: any) => i.id === ideaA));
check('at most 50 items in the list', annaWeb.items.length <= 50 && bobWeb.items.length <= 50);
const annaKeys = [...kv.keys()].filter((k) => k.startsWith('feedback:acct:anna%40a.test:'));
kv.set('feedback:acct:anna%40a.test:0000000000000:' + bobIdea.id, bobIdea.id);
check('a planted index key under Anna pointing at Bob\'s idea stays invisible to her', !(await json(await aGet(anna))).items.some((i: any) => i.id === bobIdea.id));
kv.delete('feedback:acct:anna%40a.test:0000000000000:' + bobIdea.id);
check('the account prefix encodes the address (no ":" collisions)', annaKeys.length > 0);

console.log('admin actions');
const adm = await createSession('admin@powerguardian.cloud');
check('no session → 401', (await admin(null, { id: first.id, action: 'seen' })).status === 401);
check('a customer → 401', (await admin(anna, { id: first.id, action: 'seen' })).status === 401);
check('cross-origin → 403', (await admin(adm, { id: first.id, action: 'seen' }, 'https://evil.example')).status === 403);
check('an unknown action → 400', (await admin(adm, { id: first.id, action: 'delete' })).status === 400);
check('an unknown item → 404', (await admin(adm, { id: '0'.repeat(16), action: 'seen' })).status === 404);
check('Mark seen', (await admin(adm, { id: first.id, action: 'seen' })).status === 200 && get(`feedback:item:${first.id}`).status === 'seen');
check('Reply → visible to the reporter', (await admin(adm, { id: first.id, action: 'reply', text: 'Thanks! Can you tell us which NAS?' })).status === 200 &&
  (await json(await cGet(A.token))).items.find((i: any) => i.id === first.id).replies[0].text === 'Thanks! Can you tell us which NAS?');
check('an empty reply → 400', (await admin(adm, { id: first.id, action: 'reply', text: '  ' })).status === 400);
check('a private reply to Bob, before any merge', (await admin(adm, { id: bobBug, action: 'reply', text: 'Bob, your serial ends in 4711' })).status === 200);
check('Merge into an item of the other kind → 400', (await admin(adm, { id: bobBug, action: 'merge', into: ideaA })).status === 400);
check('Merge into itself → 400', (await admin(adm, { id: first.id, action: 'merge', into: first.id })).status === 400);
check('Merge Bob\'s problem into Anna\'s, with merged_at', (await admin(adm, { id: bobBug, action: 'merge', into: first.id })).status === 200 && get(`feedback:item:${bobBug}`).merged_into === first.id && typeof get(`feedback:item:${bobBug}`).merged_at === 'number');
let bobView = (await json(await aGet(bob))).items.find((i: any) => i.id === bobBug);
check('the merged reporter keeps his own text and sees the target\'s status', bobView.text === 'b0' && bobView.status === 'seen');
check('…and his own pre-merge reply, but not the reply Anna got before the merge', bobView.replies.length === 1 && bobView.replies[0].text === 'Bob, your serial ends in 4711');
let annaSees = async () => JSON.stringify([await json(await cGet(A.token)), await json(await aGet(anna))]);
check('Bob\'s private pre-merge reply never reaches Anna (controller and website)', !(await annaSees()).includes('4711'));
check('a reply after the merge reaches both', (await admin(adm, { id: first.id, action: 'reply', text: 'Fixed in the next release.' })).status === 200 &&
  (await json(await aGet(bob))).items.find((i: any) => i.id === bobBug).replies.map((r: any) => r.text).join('|') === 'Bob, your serial ends in 4711|Fixed in the next release.' &&
  (await json(await cGet(A.token))).items.find((i: any) => i.id === first.id).replies.length === 2 && !(await annaSees()).includes('4711'));
check('Merge back the other way (a cycle) → 400', (await admin(adm, { id: first.id, action: 'merge', into: bobBug })).status === 400);
check('an action on a merged item goes to its target', (await admin(adm, { id: bobBug, action: 'plan' })).status === 200 && get(`feedback:item:${first.id}`).status === 'planned' && get(`feedback:item:${bobBug}`).status === 'seen');
check('a reply via the merged item lands on the target, not on Bob\'s own item', (await admin(adm, { id: bobBug, action: 'reply', text: 'Via the merged row' })).status === 200 &&
  get(`feedback:item:${first.id}`).replies.length === 3 && get(`feedback:item:${bobBug}`).replies.length === 1);
check('Fixed in 0.1.121', (await admin(adm, { id: first.id, action: 'fixed', fixed_in: '0.1.121' })).status === 200);
bobView = (await json(await aGet(bob))).items.find((i: any) => i.id === bobBug);
const annaView = (await json(await cGet(A.token))).items.find((i: any) => i.id === first.id);
check('…both reporters see "fixed" with fixed_in', bobView.status === 'fixed' && bobView.fixed_in === '0.1.121' && annaView.status === 'fixed' && annaView.fixed_in === '0.1.121');
check('a bad version → 400', (await admin(adm, { id: first.id, action: 'fixed', fixed_in: '<script>' })).status === 400);
check('Reject', (await admin(adm, { id: ideaA, action: 'reject' })).status === 200 && (await json(await cGet(A.token))).items.find((i: any) => i.id === ideaA).status === 'rejected');
check('a rejected item carries no fixed_in', !('fixed_in' in (await json(await cGet(A.token))).items.find((i: any) => i.id === ideaA)));
const audit = await listAudit(200);
check('every admin change is in the audit log', ['feedback.seen', 'feedback.reply', 'feedback.merge', 'feedback.plan', 'feedback.fixed', 'feedback.reject'].every((a) => audit.some((e) => e.action === a && e.role === 'admin' && e.actor === 'admin@powerguardian.cloud')));

console.log('admin rows');
const all = await listAll();
check('listAll: every item, not truncated', !all.truncated && all.items.length === items().length);
const rows = adminRows(all.items);
const row = rows.find((x) => x.id === first.id)!;
check('one row per root: count = 1 + merged, distinct customers', row.count === 2 && row.customers === 2 && !rows.some((x) => x.id === bobBug));
check('…with the versions and report ids of all its reports', row.versions.includes('0.1.120') && row.reports.includes('PGR-ABCD-EFGH'));
const loop = { id: 'a', merged_into: 'b' } as any, loop2 = { id: 'b', merged_into: 'a' } as any;
check('a circular merge chain stops (no endless loop)', ['a', 'b'].includes(rootOf(loop, (id) => (id === 'a' ? loop : loop2)).id));

console.log('store: one read for many keys, truncation reported');
const { kvListValues, kvGetMany } = await import('../app/lib/kv.ts');
for (let i = 0; i < 5; i++) kv.set(`zz:t:${i}`, `v${i}`);
const few = await kvListValues('zz:t:', 3), alle = await kvListValues('zz:t:', 10);
check('kvListValues: at most max, truncated when there are more', few.entries.length === 3 && few.truncated && few.entries[0][0] === 'zz:t:0' && few.entries[0][1] === 'v0');
check('…and everything when it fits', alle.entries.length === 5 && !alle.truncated);
const many = await kvGetMany(['zz:t:1', 'zz:t:4', 'zz:nope']);
check('kvGetMany: the values that exist', many.size === 2 && many.get('zz:t:4') === 'v4');

console.log('admin cookie');
const bad = await adminPost(new Request(SITE + '/api/admin/feedback', { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE, cookie: 'pg_session=%E0%A4%A' }, body: '{}' }));
check('a malformed session cookie → 401, not 500', bad.status === 401);
done();
