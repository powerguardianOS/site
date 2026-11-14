// LOGIN-1: the sign-in link from the mail must survive a mail scanner / link preview / prefetch that opens it first,
// a used or expired link must say so on /login (never a silent homepage), www must go to the apex host, and a fresh
// session must not bounce to /login when KV has not caught up yet.
import { kv, mails, check, done } from './harness.mts';
import { NextRequest } from 'next/server';
import { POST as register } from '../app/api/auth/register/route.ts';
import * as verify from '../app/api/auth/verify/route.ts';
const verifyGet = verify.GET as (r: NextRequest) => Promise<Response>;
const verifyPost: (r: NextRequest) => Promise<Response> = (verify as any).POST ?? (async () => new Response(null, { status: 405 }));
import { middleware } from '../middleware.ts';
import { getSession, createSession } from '../app/lib/session.ts';

const SITE = 'https://powerguardian.cloud';
const E = 'roy@gmail.com';
const logs: string[] = [];
for (const m of ['log', 'info', 'warn', 'error'] as const) {
  const orig = console[m].bind(console);
  (console as any)[m] = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); if (m === 'log') orig(...a); };
}

async function askLink(email = E): Promise<string> {
  const r = await register(new Request(SITE + '/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' }, body: JSON.stringify({ email }),
  }));
  if (r.status !== 200) throw new Error('register ' + r.status);
  return mails.at(-1)!.text.match(/https?:\/\/\S+\/api\/auth\/verify\?token=[0-9a-f]+/)![0];
}
const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;
const get = (link: string, headers: Record<string, string> = {}) => verifyGet(new NextRequest(link, { headers }));
const post = (token: string, origin: string | null = SITE) => {
  const h: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  if (origin) h.origin = origin;
  return verifyPost(new NextRequest(SITE + '/api/auth/verify', { method: 'POST', headers: h, body: new URLSearchParams({ token }).toString() }));
};
const sessionCookie = (r: Response) => (r.headers.get('set-cookie') ?? '').match(/pg_session=([^;]*)/)?.[1] ?? '';

console.log('a link opened by a scanner first still signs the user in');
const link = await askLink();
check('the link in the mail points at the apex host', link.startsWith(SITE + '/api/auth/verify?token='), link.replace(/token=.*/, 'token=…'));
const scan = await get(link, { 'user-agent': 'Mozilla/5.0 (compatible; Google-Safety)' });
check('a GET (scanner, preview, prefetch) does not sign in', !sessionCookie(scan));
check('a GET does not use up the link', kv.has('magic:' + tokenOf(link)));
const tap = await get(link);
const html = await tap.text();
check('the user\'s tap afterwards shows "Sign in as r***@gmail.com" with one button', tap.status === 200 && html.includes('r***@gmail.com') && /<form[^>]+method="post"/i.test(html) && html.includes('name="token"'));
check('the confirm page is not cached and does not leak the link to other sites',
  /no-store/.test(tap.headers.get('cache-control') ?? '') && (tap.headers.get('referrer-policy') ?? '') === 'same-origin');
const ok = await post(tokenOf(link));
const cookie = sessionCookie(ok);
check('the button (POST) signs in and goes to /account', ok.status === 303 && new URL(ok.headers.get('location')!, SITE).pathname === '/account' && !!cookie);
check('the session cookie is HttpOnly, Secure, SameSite=Lax', /HttpOnly/i.test(ok.headers.get('set-cookie')!) && /Secure/i.test(ok.headers.get('set-cookie')!) && /SameSite=Lax/i.test(ok.headers.get('set-cookie')!));
check('the session is valid', (await getSession(decodeURIComponent(cookie))) === E);
check('the link is used up after the POST', !kv.has('magic:' + tokenOf(link)));

console.log('\nused, expired and broken links say so on /login');
const again = await get(link);
const loc = (r: Response) => new URL(r.headers.get('location') ?? '/', SITE);
check('a used link (GET) goes to /login with the expired message, not the homepage', again.status >= 300 && again.status < 400 && loc(again).pathname === '/login' && loc(again).searchParams.get('error') === 'link');
const again2 = await post(tokenOf(link));
check('a used link (POST) also goes to /login?error=link and signs nobody in', loc(again2).pathname === '/login' && loc(again2).searchParams.get('error') === 'link' && !sessionCookie(again2));
// A double tap on Sign in (the second POST wins in the browser) or an old mail link opened while already signed in
// must land on the account, not on "expired".
const signedIn = { cookie: 'pg_session=' + cookie };
const dbl = await verifyPost(new NextRequest(SITE + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITE, ...signedIn }, body: new URLSearchParams({ token: tokenOf(link) }).toString() }));
check('a second tap on Sign in while signed in goes to /account', loc(dbl).pathname === '/account', loc(dbl).toString());
const oldTap = await get(link, signedIn);
check('an old link opened while signed in goes to /account', loc(oldTap).pathname === '/account', loc(oldTap).toString());
const bogus = await get(link, { cookie: 'pg_session=forged.cookie' });
check('with a bad session cookie a used link still says expired', loc(bogus).pathname === '/login' && loc(bogus).searchParams.get('error') === 'link');
const old = await askLink('old@x.nl');
kv.set('magic:' + tokenOf(old), JSON.stringify({ email: 'old@x.nl', expires: Date.now() - 1000 }));
const exp = await get(old);
check('an expired link goes to /login?error=link', loc(exp).pathname === '/login' && loc(exp).searchParams.get('error') === 'link');
const none = await get(SITE + '/api/auth/verify');
check('a link without token goes to /login?error=link', loc(none).pathname === '/login' && loc(none).searchParams.get('error') === 'link');

console.log('\nthe button only works from this site');
const l3 = await askLink('csrf@x.nl');
const cross = await post(tokenOf(l3), 'https://evil.example');
check('a POST from another site is refused and does not use up the link', cross.status === 403 && !sessionCookie(cross) && kv.has('magic:' + tokenOf(l3)));
const noOrigin = await post(tokenOf(l3), null);
check('a POST without Origin is refused', noOrigin.status === 403 && kv.has('magic:' + tokenOf(l3)));

console.log('\none host: www goes to the apex');
const mw = (u: string) => middleware(new NextRequest(u, { headers: { host: new URL(u).host } }));
const w = mw('https://www.powerguardian.cloud/api/auth/verify?token=abc&x=1');
check('www → apex, permanent, path and query kept', (w.status === 308 || w.status === 301) && w.headers.get('location') === 'https://powerguardian.cloud/api/auth/verify?token=abc&x=1');
const w2 = mw('https://www.powerguardian.cloud/');
check('www homepage → apex homepage', w2.headers.get('location') === 'https://powerguardian.cloud/');
const apex = mw('https://powerguardian.cloud/pricing');
check('the apex itself is not redirected', !apex.headers.get('location'));
const acc = mw('https://powerguardian.cloud/account');
check('/account without a cookie still goes to /login', new URL(acc.headers.get('location') ?? '/', SITE).pathname === '/login');
process.env.NEXT_PUBLIC_BASE_URL = 'https://www.powerguardian.cloud';
const l4 = await askLink('www@x.nl');
check('the mailed link uses the apex even when the base URL is set to www', l4.startsWith('https://powerguardian.cloud/api/auth/verify?token='));
delete process.env.NEXT_PUBLIC_BASE_URL;

console.log('\na fresh session survives KV lag');
const fresh = await createSession('lag@x.nl');
const sid = [...kv.keys()].find((k) => k.startsWith('session:') && kv.get(k)!.includes('lag@x.nl'))!;
const saved = kv.get(sid)!;
kv.delete(sid); // KV has not caught up yet
check('a just-created session is trusted from its signed cookie while KV lags', (await getSession(fresh)) === 'lag@x.nl');
check('after the grace period, a session KV does not know is refused', (await getSession(fresh, Date.now() + 5 * 60_000)) === null);
const forged = fresh.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
check('a cookie with a changed signature is refused', (await getSession(forged)) === null);
const otherEmail = fresh.split('.').map((p, i) => (i === 3 ? Buffer.from('evil@x.nl').toString('base64url') : p)).join('.');
check('a cookie with a changed email is refused', (await getSession(otherEmail)) === null);
kv.set(sid, saved);
check('the same session reads normally once KV has it', (await getSession(fresh, Date.now() + 5 * 60_000)) === 'lag@x.nl');

console.log('\nthe link stays out of the logs');
const allTokens = mails.map((m) => m.text.match(/token=([0-9a-f]+)/)?.[1]).filter(Boolean) as string[];
check('no log line contains a sign-in token', allTokens.length > 3 && !logs.some((l) => allTokens.some((t) => l.includes(t))));

done();
