// CLOUD-2: no secrets in logs, rate limits on register/magic, KV writes fail closed.
// Run: npx tsx tests/cloud2.test.mts
import { kv, mails, check, done } from './harness.mts';

process.env.NEXT_PUBLIC_BASE_URL = 'https://site.test';
let failPuts = false;
const base = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  if (failPuts && (init.method ?? 'GET') === 'PUT' && String(url).includes('/values/')) return new Response('boom', { status: 500 });
  return base(url, init);
};
const logs: string[] = [];
const orig: Record<string, any> = {};
const capture = (on: boolean) => { for (const m of ['log', 'error', 'warn', 'info']) { if (on) { orig[m] = (console as any)[m]; (console as any)[m] = (...a: unknown[]) => logs.push(a.map(String).join(' ')); } else (console as any)[m] = orig[m]; } };
const out = (s: string) => console.log(s);

const { POST: register } = await import('../app/api/auth/register/route.ts');
const { POST: magic } = await import('../app/api/auth/magic/route.ts');
const { createSession } = await import('../app/lib/session.ts');
const { createMagicToken } = await import('../app/lib/magic-link.ts');
const { createAccount } = await import('../app/lib/accounts.ts');

const req = (url: string, email: string, ip = '1.1.1.1') =>
  new Request('http://x' + url, { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ email }) }) as any;
const stat = async (r: Response) => r.status;

out('register: never log the sign-in link');
// Brevo down -> the old code logged "FALLBACK URL: <link>".
const realFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init: any) => String(url).includes('api.brevo.com') ? new Response('no', { status: 500 }) : realFetch(url, init);
capture(true);
const rFail = await register(req('/api/auth/register', 'a@x.nl', '2.2.2.2'));
capture(false);
check('a failed mail is reported as an error, not a silent ok', rFail.status >= 500);
check('no log line contains the magic link or a token', !logs.some((l) => /api\/auth\/verify|token=|magic:/i.test(l)), logs.join(' | ').slice(0, 120));
(globalThis as any).fetch = realFetch;

out('\nregister: rate limit');
mails.length = 0;
const codes: number[] = [];
for (let i = 0; i < 5; i++) codes.push(await stat(await register(req('/api/auth/register', 'same@x.nl', '3.3.3.3'))));
check('per e-mail: the 4th request within the hour is refused (429)', codes.slice(0, 3).every((c) => c === 200) && codes[3] === 429, codes.join(','));
check('refused requests send no mail', mails.filter((m) => m.to === 'same@x.nl').length === 3);
const ipCodes: number[] = [];
for (let i = 0; i < 12; i++) ipCodes.push(await stat(await register(req('/api/auth/register', `u${i}@x.nl`, '4.4.4.4'))));
check('per IP: the 11th distinct address from one IP is refused (429)', ipCodes.slice(0, 10).every((c) => c === 200) && ipCodes[10] === 429, ipCodes.join(','));

out('\nmagic: rate limit per e-mail as well as per IP');
const mc: number[] = [];
for (let i = 0; i < 5; i++) mc.push(await stat(await magic(req('/api/auth/magic', 'm@x.nl', `5.5.5.${i}`))));
check('magic: same address from 5 different IPs is limited per e-mail', mc.includes(429), mc.join(','));

out('\nKV writes fail closed');
failPuts = true;
let threw = 0;
for (const f of [() => createSession('a@x.nl'), () => createMagicToken('a@x.nl'), () => createAccount('new@x.nl')]) {
  try { await f(); } catch { threw++; }
}
check('session / magic token / account creation throw when KV refuses the write', threw === 3, `${threw}/3`);
mails.length = 0;
const rKv = await register(req('/api/auth/register', 'kvdown@x.nl', '6.6.6.6'));
check('register with KV down: error, and no mail with a link nobody can redeem', rKv.status >= 500 && mails.length === 0, `${rKv.status}, ${mails.length} mails`);
const mKv = await magic(req('/api/auth/magic', 'kvdown@x.nl', '6.6.6.7'));
check('magic with KV down: error, no mail', mKv.status >= 500 && mails.length === 0, `${mKv.status}`);
failPuts = false;
void kv;
done();
