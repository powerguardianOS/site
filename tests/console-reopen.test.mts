// REOPEN: a refresh on a site's console host after its ten-minute console token expired. The relay sends the page load
// to /console/reopen?site=<16 hex label>&path=<same-host path>; only the signed-in owner of that site gets a fresh
// console link (minted like Open Console, with the AUTO-SSO console intent) and lands back on the same page.
// Run: npx tsx tests/console-reopen.test.mts
import { kv, seed, lic, check, done } from './harness.mts';
import { createSession } from '../app/lib/session.ts';
import { createMagicToken } from '../app/lib/magic-link.ts';
import { NextRequest } from 'next/server';

process.env.RELAY_MINT_SECRET = 'mint-secret';
const mints: string[] = [];
const kvFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  if (String(url).startsWith('https://relay.powerguardian.cloud/mint/')) { mints.push(String(url).split('/').pop()!); return Response.json({ token: 'sub.tok', jti: 'j', expires_at: 1 }); }
  return kvFetch(url, init);
};
const { GET: reopenGET } = await import('../app/console/reopen/route.ts');
const { POST: verify } = await import('../app/api/auth/verify/route.ts');
const { siteLabel } = await import('../app/lib/relay-mint.ts');
const { intentCookieName } = await import('../app/lib/console-intent.ts');
const { safeConsolePath, reopenTarget } = await import('../app/lib/console-reopen.ts');

seed(
  lic('lic-acer', 'acme@test', { plan: 'pro', site_name: 'Acer' }),
  lic('lic-mal', 'mallory@test', { plan: 'pro', site_name: 'Mal' }),
  lic('lic-basic', 'acme@test', { plan: 'basic', site_name: 'Basic' }),
);
const acme = await createSession('acme@test', { mfa: true });
const mallory = await createSession('mallory@test', { mfa: true });
const ACER = await siteLabel('lic-acer'), MAL = await siteLabel('lic-mal');
const acerHost = `https://${ACER}-console.powerguardian.cloud`;
const url = (site: string, path?: string) => 'https://powerguardian.cloud/console/reopen?' + new URLSearchParams({ site, ...(path !== undefined ? { path } : {}) }).toString();
const reopen = (u: string, session?: string) => reopenGET(new Request(u, { headers: session ? { cookie: 'pg_session=' + session } : {} }));
const audits = () => [...kv.entries()].filter(([k]) => k.startsWith('audit:')).map(([, v]) => JSON.parse(v));

console.log('without a cloud session');
let before = mints.length;
let r = await reopen(url(ACER, '/settings?tab=ups'));
const sc0 = r.headers.get('set-cookie') ?? '';
check('→ sign in first (303 /login?next=console), nothing minted', r.status === 303 && r.headers.get('location') === '/login?next=console' && mints.length === before);
check('…the reopen remembered in a short HttpOnly cookie', /pg_reopen_next=[^;]+; Path=\/; Max-Age=600; HttpOnly; Secure; SameSite=Lax/.test(sc0), sc0);
const remembered = decodeURIComponent(sc0.match(/pg_reopen_next=([^;]+)/)?.[1] ?? '');
const vr = await verify(new NextRequest('https://powerguardian.cloud/api/auth/verify', {
  method: 'POST', body: new URLSearchParams({ token: await createMagicToken('acme@test') }).toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://powerguardian.cloud', cookie: 'pg_reopen_next=' + encodeURIComponent(remembered) },
}));
const step = (vr.headers.get('set-cookie') ?? '').match(/pg_signin=([0-9a-f]+)/)?.[1] ?? '';
// straight on (no two-step for this account) or via the two-step page, whose pending sign-in keeps the target
const next = step && kv.has('signin:step:' + step) ? JSON.parse(kv.get('signin:step:' + step)!).next as string
  : (vr.headers.get('location') ?? '').replace('https://powerguardian.cloud', '');
check('after signing in (and two-step) the browser continues to the same reopen', next === '/console/reopen?' + new URLSearchParams({ site: ACER, path: '/settings?tab=ups' }).toString(), next);
check('…and the remembered cookie is cleared', /pg_reopen_next=;/.test(vr.headers.get('set-cookie') ?? ''));
check('a tampered remembered value never points elsewhere', reopenTarget('site=xyz&path=/') === '' && reopenTarget('site=' + ACER + '&path=//evil.com') === `/console/reopen?site=${ACER}&path=%2F` && reopenTarget('https://evil.com') === '');

console.log('\nthe owner, signed in');
before = mints.length;
r = await reopen(url(ACER, '/settings?tab=ups'), acme);
const loc = r.headers.get('location') ?? '';
check('own site → 303 to its console with the path appended', r.status === 303 && loc === `${acerHost}/console/sub.tok/settings?tab=ups`, loc);
check('…minted for that site', mints.length === before + 1 && mints.at(-1) === 'lic-acer');
const sc = r.headers.get('set-cookie') ?? '';
check('…with the AUTO-SSO console intent, like Open Console', sc.startsWith((await intentCookieName('lic-acer')) + '=ci1.'), sc);
check('…no-store, no referrer', r.headers.get('cache-control') === 'no-store' && r.headers.get('referrer-policy') === 'no-referrer');
const a = audits().find((e) => e.action === 'console.open' && e.license_id === 'lic-acer');
check('…audited as console.open via reopen for the owner', a?.detail === 'reopen' && a?.actor === 'acme@test' && a?.email === 'acme@test', JSON.stringify(a));
r = await reopen(url(ACER, '/'), acme);
check('path / → the console root', r.headers.get('location') === `${acerHost}/console/sub.tok`);
r = await reopen(url(ACER), acme);
check('no path → the console root', r.headers.get('location') === `${acerHost}/console/sub.tok`);

console.log('\nbad paths are never appended');
for (const p of ['//evil.com', '//evil.com/x', '/\\evil.com', 'https://evil.com', 'evil.com', '/a b', '/x\r\nSet-Cookie: a=b', '/' + 'a'.repeat(600)]) {
  r = await reopen(url(ACER, p), acme);
  check(`path ${JSON.stringify(p.slice(0, 30))} → console root only`, r.headers.get('location') === `${acerHost}/console/sub.tok`, r.headers.get('location') ?? '');
}
check('safeConsolePath keeps a normal path and query', safeConsolePath('/a/b?c=d') === '/a/b?c=d' && safeConsolePath(null) === '/');

console.log('\nother accounts\' sites');
before = mints.length;
r = await reopen(url(ACER, '/'), mallory);
const body = await r.text();
check('mallory reopening acme\'s label → 404 "This site is not on your account", nothing minted, no redirect', r.status === 404 && body.includes('This site is not on your account') && mints.length === before && !r.headers.get('location'));
r = await reopen(url('0123456789abcdef'), mallory);
const body2 = await r.text();
check('…exactly the same answer as a label that does not exist', r.status === 404 && body2 === body);
r = await reopen(url('ACER'), acme);
check('a malformed label → 404', r.status === 404 && !r.headers.get('location'));
r = await reopen(url(MAL), mallory);
check('(control) mallory reopens her own site', r.status === 303 && (r.headers.get('location') ?? '').startsWith(`https://${MAL}-console.powerguardian.cloud/console/`));
r = await reopen(url(await siteLabel('lic-basic')), acme);
check('own site without the remote console in its plan → 403, nothing minted', r.status === 403 && !r.headers.get('location'));

console.log('\nrate limit');
let last: Response | null = null;
for (let i = 0; i < 40; i++) last = await reopen(url(MAL), mallory);
check('too many reopens → 429, nothing more minted', last!.status === 429 && !last!.headers.get('location'));

done();
