// CLOUD-SSO: "Sign in with PowerGuardian Cloud" (app/sso/authorize, app/lib/sso.ts).
// Run: npx tsx tests/sso.test.mts
import { kv, seed, lic, check, done, PUBKEY } from './harness.mts';
import { createSession } from '../app/lib/session.ts';
import { ssoReturnOrigin, SSO_PREFIX } from '../app/lib/sso.ts';
import { verifyLease } from '../app/lib/lease.ts';
import { GET, POST } from '../app/sso/authorize/route.ts';
import { POST as verify } from '../app/api/auth/verify/route.ts';
import { createMagicToken } from '../app/lib/magic-link.ts';
import { NextRequest } from 'next/server';

const CTRL_A = 'a'.repeat(64), CTRL_B = 'b'.repeat(64);
const NONCE = 'f'.repeat(48);
const RET = 'https://192.168.10.235/api/auth/sso/callback';

seed(
  lic('site-roy', 'roy@x.nl', { plan: 'founder', claimed_by: CTRL_A, site_name: 'Acer' }),
  lic('site-eve', 'eve@x.nl', { claimed_by: CTRL_B, site_name: 'Eve' }),
);
const roy = await createSession('roy@x.nl');
const eve = await createSession('eve@x.nl');

const q = (o: Record<string, string>) => new URLSearchParams({ controller: CTRL_A, nonce: NONCE, return: RET, ...o }).toString();
const get = (query: string, session?: string) =>
  GET(new Request('https://powerguardian.cloud/sso/authorize?' + query, { headers: session ? { cookie: 'pg_session=' + session } : {} }));
const post = (fields: Record<string, string>, session?: string, origin = 'https://powerguardian.cloud') =>
  POST(new Request('https://powerguardian.cloud/sso/authorize', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(session ? { cookie: 'pg_session=' + session } : {}), ...(origin ? { origin } : {}) },
    body: new URLSearchParams({ controller: CTRL_A, nonce: NONCE, return: RET, ...fields }).toString(),
  }));

// verify a statement the way the controller does: prefix in the signed bytes, lease public key
async function decode(token: string) {
  const dot = token.lastIndexOf('.');
  const msg = token.slice(0, dot), sig = token.slice(dot + 1);
  const unb = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(PUBKEY), (c) => c.charCodeAt(0)), { name: 'Ed25519' }, false, ['verify']);
  const ok = msg.startsWith(SSO_PREFIX) && await crypto.subtle.verify({ name: 'Ed25519' }, key, unb(sig), new TextEncoder().encode(msg));
  return ok ? JSON.parse(new TextDecoder().decode(unb(msg.slice(SSO_PREFIX.length)))) : null;
}

console.log('return address rules');
for (const [u, ok] of [
  [RET, true],
  ['https://192.168.10.235:8443/api/auth/sso/callback', true],
  ['https://10.1.2.3/api/auth/sso/callback', true],
  ['https://172.20.0.1/api/auth/sso/callback', true],
  ['https://powerguardian.local/api/auth/sso/callback', true],
  ['https://e1beb6d6a5ea79e7-console.powerguardian.cloud/api/auth/sso/callback', true], // a site's own console host (ISO-1)
  ['https://console.powerguardian.cloud/api/auth/sso/callback', false], // ISO-1: shared relay hosts no longer
  ['https://relay.powerguardian.cloud/api/auth/sso/callback', false],
  ['https://hp-3f9a.console.powerguardian.cloud/api/auth/sso/callback', false],
  ['https://e1beb6d6a5ea79e7-console.powerguardian.cloud:8443/api/auth/sso/callback', false],
  ['https://evil.example/api/auth/sso/callback', false],
  ['https://console.powerguardian.cloud.evil.example/api/auth/sso/callback', false],
  ['https://8.8.8.8/api/auth/sso/callback', false],
  ['https://172.32.0.1/api/auth/sso/callback', false],
  ['http://192.168.10.235/api/auth/sso/callback', false],
  ['https://192.168.10.235/elsewhere', false],
  ['https://192.168.10.235/api/auth/sso/callback?x=1', false],
  ['https://u:p@192.168.10.235/api/auth/sso/callback', false],
  ['javascript:alert(1)', false],
] as [string, boolean][]) check(`${ok ? 'accepts' : 'refuses'} ${u}`, (ssoReturnOrigin(u) !== null) === ok);

console.log('\nauthorize: GET');
let r = await get(q({}));
check('not signed in → login first, request remembered in a short cookie', r.status === 303 && r.headers.get('location') === '/login?next=sso' && (r.headers.get('set-cookie') ?? '').includes('pg_sso_next=') && (r.headers.get('set-cookie') ?? '').includes('HttpOnly'));
r = await get(q({}), roy);
const html = await r.text();
check('owner sees "Sign in to Acer" with the address it goes back to', r.status === 200 && html.includes('Sign in to Acer') && html.includes('192.168.10.235') && html.includes('roy@x.nl'));
r = await get(q({}), eve);
check('an account that does not own this controller gets a readable no-access page', r.status === 403 && (await r.text()).includes('No access to this controller'));
r = await get(q({ return: 'https://evil.example/api/auth/sso/callback' }), roy);
check('open redirect refused', r.status === 400);
r = await get(q({ controller: 'nope' }), roy);
check('bad controller id refused', r.status === 400);
r = await get(q({ controller: 'c'.repeat(64) }), roy);
check('a controller nobody holds: no access', r.status === 403);

console.log('\nauthorize: POST (Continue)');
r = await post({}, roy);
const loc = r.headers.get('location') ?? '';
check('owner → 303 back to the controller callback with a statement', r.status === 303 && loc.startsWith(RET + '?assertion='));
const token = decodeURIComponent(loc.split('assertion=')[1] ?? '');
const a = await decode(token);
check('statement verifies with the lease public key', !!a);
check('statement names controller, site, nonce, address, owner as admin', a?.controller_id === CTRL_A && a?.site_id === 'site-roy' && a?.nonce === NONCE && a?.aud === 'https://192.168.10.235' && a?.role === 'admin' && a?.sub === 'email:roy@x.nl' && a?.typ === 'sso');
check('statement lives 60 seconds', a && a.exp - a.iat === 60);
check('a statement is not a lease', (await verifyLease(token, PUBKEY)) === null);
r = await post({}, eve);
check('another account: no statement', r.status === 403 && !r.headers.get('location'));
r = await post({}, roy, 'https://evil.example');
check('cross-site form post refused', r.status === 403 && !r.headers.get('location'));
r = await post({}, roy, '');
check('form post without Origin refused', r.status === 403);
r = await get(q({}), roy);
check('the Continue page does not use Referrer-Policy no-referrer (browsers then send "Origin: null" on the form POST)', r.headers.get('referrer-policy') !== 'no-referrer');
r = await post({}, roy, 'null');
check('a form post with "Origin: null" is refused cleanly (403, not a crash)', r.status === 403);
r = await post({}, undefined);
check('no session: no statement', r.status === 401);
r = await post({ return: 'https://evil.example/api/auth/sso/callback' }, roy);
check('POST with a foreign return address refused', r.status === 400 && !r.headers.get('location'));
r = await post({ controller: CTRL_B }, roy);
check('statement for site B from owner of site A refused', r.status === 403);

console.log('\nsign in first, then back to the controller');
// LOGIN-1: the link's GET only shows a confirm page; the button POSTs. CLOUD-MFA: roy manages a site, so two-step
// sign-in comes first (tests/mfa.test.mts walks it to the end); the pending sign-in remembers where to go next.
const confirmLink = async (cookie?: string) => verify(new NextRequest('https://powerguardian.cloud/api/auth/verify', {
  method: 'POST', body: new URLSearchParams({ token: await createMagicToken('roy@x.nl') }).toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://powerguardian.cloud', ...(cookie ? { cookie } : {}) },
}));
const pendingNext = (res: Response) => {
  const id = (res.headers.get('set-cookie') ?? '').match(/pg_signin=([0-9a-f]+)/)?.[1] ?? '';
  return id && kv.has('signin:step:' + id) ? JSON.parse(kv.get('signin:step:' + id)!).next as string : '';
};
const vr = await confirmLink('pg_sso_next=' + encodeURIComponent(q({})));
const back = pendingNext(vr);
check('after the magic link (and two-step sign-in) the browser goes back to the authorize page', back.startsWith('/sso/authorize?') && back.includes(CTRL_A));
check('the remembered controller request is cleared', /pg_sso_next=;/.test(vr.headers.get('set-cookie') ?? ''));
const vr2 = await confirmLink();
check('without a pending sign-in it still goes to the account page', pendingNext(vr2) === '/account');

done();
