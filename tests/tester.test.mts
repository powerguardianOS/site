// "Become a tester": sign-up form API and the admin list. Negative cases first-class: invalid input, honeypot,
// rate limits, and nobody but the admin can read the list.
// Run: npx tsx tests/tester.test.mts
import { kv, get, mails, check, done } from './harness.mts';
import { createSession } from '../app/lib/session.ts';

const { POST: signUp } = await import('../app/api/tester/route.ts');
const { GET: adminList } = await import('../app/api/admin/testers/route.ts');
const { testersCsv } = await import('../app/lib/testers.ts');

const good = (o: Record<string, unknown> = {}) => ({
  email: 'Tess@Example.com', name: 'Tess', country: 'Netherlands', ups: 'Eaton 5PX 1500', protects: ['nas', 'network'],
  ups_count: 2, heard: 'Tweakers', consent: true, website: '', ...o,
});
let ipN = 0;
const post = (body: unknown, ip = `10.0.0.${++ipN}`, ct = 'application/json') =>
  signUp(new Request('https://powerguardian.cloud/api/tester', { method: 'POST', headers: { 'content-type': ct, 'cf-connecting-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const json = async (r: Response) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }) as any;
const testerKeys = () => [...kv.keys()].filter((k) => k.startsWith('tester:'));
const licences = () => [...kv.keys()].filter((k) => k.startsWith('license:')).length;

console.log('sign-up');
const lic0 = licences();
let r = await json(await post(good()));
const t = get('tester:tess@example.com');
check('a valid sign-up is stored under tester:<email> (lower case)', r.status === 200 && r.ok && t?.ups === 'Eaton 5PX 1500' && t.ups_count === 2 && t.protects.join() === 'nas,network' && t.consent === true);
check('…listed in tester:index', JSON.stringify(get('tester:index')) === '["tess@example.com"]');
check('…and a confirmation mail goes to that address', mails.at(-1)?.to === 'tess@example.com' && /tester/i.test(mails.at(-1)!.subject));
check('no licence is created automatically', licences() === lic0);
r = await json(await post(good({ ups: 'APC Smart-UPS 1000' })));
check('signing up again updates the same record (no duplicate in the list)', r.status === 200 && get('tester:tess@example.com').ups === 'APC Smart-UPS 1000' && get('tester:index').length === 1 && get('tester:tess@example.com').created_at === t.created_at);

console.log('validation (nothing stored, no mail)');
const before = testerKeys().length, mails0 = mails.length;
for (const [label, body, field] of [
  ['invalid email', good({ email: 'not-an-email' }), 'email'],
  ['email with spaces', good({ email: 'a b@x.nl' }), 'email'],
  ['missing email', good({ email: undefined }), 'email'],
  ['email as an object', good({ email: { $ne: '' } }), 'email'],
  ['no country', good({ country: '  ' }), 'country'],
  ['no UPS', good({ ups: '' }), 'ups'],
  ['nothing to protect', good({ protects: [] }), 'protects'],
  ['an unknown protect value', good({ protects: ['nas', 'toaster'] }), 'protects'],
  ['0 UPSes', good({ ups_count: 0 }), 'ups_count'],
  ['1.5 UPSes', good({ ups_count: 1.5 }), 'ups_count'],
  ['no consent', good({ consent: false }), 'consent'],
  ['consent as the string "true"', good({ consent: 'true' }), 'consent'],
] as const) {
  r = await json(await post(body));
  check(`${label} → 400 (${field})`, r.status === 400 && r.field === field, JSON.stringify(r));
}
check('…none of them stored or mailed anything', testerKeys().length === before && mails.length === mails0);
check('a form post (not JSON) is refused: 415', (await post('email=a@b.nl', undefined, 'application/x-www-form-urlencoded')).status === 415);
check('garbage JSON → 400', (await post('{nope')).status === 400);

console.log('honeypot');
r = await json(await post(good({ email: 'bot@spam.example', website: 'http://spam.example' })));
check('honeypot filled: the bot sees the normal answer (200)…', r.status === 200 && r.ok === true);
check('…but nothing is stored and no mail is sent', !get('tester:bot@spam.example') && !get('tester:index').includes('bot@spam.example') && mails.length === mails0);

console.log('control characters and length');
r = await json(await post(good({ email: 'ctl@x.nl', name: 'Evil\r\nBcc: x@y.z', ups: 'U'.repeat(500) })));
const c = get('tester:ctl@x.nl');
check('line breaks are removed and fields are cut to length', r.status === 200 && !/[\r\n]/.test(c.name) && c.ups.length === 200);

console.log('rate limits');
const statuses: number[] = [];
for (let i = 0; i < 4; i++) statuses.push((await post(good({ email: 'flood@x.nl' }))).status);
check('the same address: 3 per hour, the 4th → 429', statuses.join() === '200,200,200,429', statuses.join());
const ipStat: number[] = [];
for (let i = 0; i < 6; i++) ipStat.push((await post(good({ email: `ip${i}@x.nl` }), '203.0.113.9')).status);
check('the same IP: 5 per hour, the 6th → 429', ipStat.join() === '200,200,200,200,200,429', ipStat.join());
check('…the refused one is not stored', !get('tester:ip5@x.nl'));
// KV down: sign-up fails closed (it sends mail).
const kvFetch = globalThis.fetch;
(globalThis as any).fetch = async (u: string, i: any) => (String(u).includes('/values/rl%3A') ? new Response('', { status: 500 }) : kvFetch(u, i));
r = await json(await post(good({ email: 'down@x.nl' })));
(globalThis as any).fetch = kvFetch;
check('rate limiter unavailable → 503, nothing stored', r.status === 503 && !get('tester:down@x.nl'));

console.log('admin list');
const adminCookie = await createSession('admin@powerguardian.cloud');
const userCookie = await createSession('tess@example.com');
const list = (cookie?: string, q = '') =>
  adminList(new Request('https://powerguardian.cloud/api/admin/testers' + q, { headers: cookie ? { cookie: 'pg_session=' + cookie } : {} }));
check('no session → 401', (await list()).status === 401);
check('a signed-in customer (even a tester) → 401', (await list(userCookie)).status === 401);
check('a made-up session id → 401', (await list('f'.repeat(64))).status === 401);
check('a customer cannot download the CSV either → 401', (await list(userCookie, '?format=csv')).status === 401);
const saved = process.env.ADMIN_EMAIL; delete process.env.ADMIN_EMAIL;
check('ADMIN_EMAIL unset → even the admin session is refused', (await list(adminCookie)).status === 401);
process.env.ADMIN_EMAIL = saved;
const ok = await json(await list(adminCookie));
check('the admin gets the list, newest first', ok.status === 200 && ok.testers.length === testerKeys().filter((k) => k !== 'tester:index').length && ok.testers.some((x: any) => x.email === 'tess@example.com'));
const csvRes = await list(adminCookie, '?format=csv');
const csv = await csvRes.text();
check('the admin gets a CSV download', csvRes.status === 200 && (csvRes.headers.get('content-type') ?? '').startsWith('text/csv') && (csvRes.headers.get('content-disposition') ?? '').includes('attachment') && csv.startsWith('signed_up,email,name,country,ups,protects,ups_count,heard,consent\n') && csv.includes('"tess@example.com"'));
const evil = testersCsv([{ email: 'e@x.nl', name: '=HYPERLINK("http://evil")', country: '+31', ups: '@SUM(A1)', protects: ['other'], ups_count: 1, heard: 'say "hi"', consent: true, created_at: 'x', updated_at: 'x' }]);
check('CSV: formulas are neutralised and quotes doubled', evil.includes(`"'=HYPERLINK(""http://evil"")"`) && evil.includes(`"'+31"`) && evil.includes(`"'@SUM(A1)"`) && evil.includes('"say ""hi"""'));
done();
