// CLOUD-MFA: two-step sign-in for PowerGuardian Cloud accounts (TOTP + recovery codes), enforced for accounts with
// sites, and the SSO statement's mfa claim. Run: npx tsx tests/mfa.test.mts
import { kv, seed, lic, check, done, PUBKEY } from './harness.mts';
import { NextRequest } from 'next/server';
import { createMagicToken } from '../app/lib/magic-link.ts';
import { POST as confirmLink } from '../app/api/auth/verify/route.ts';
import { GET as stepGet, POST as stepPost } from '../app/login/mfa/route.ts';
import { GET as mfaGet, POST as mfaPost } from '../app/api/account/mfa/route.ts';
import { POST as ssoPost } from '../app/sso/authorize/route.ts';
import { getSessionInfo, createSession } from '../app/lib/session.ts';
import { totpAt, stepOf, matchTotp, base32, unbase32, sealSecret, openSecret, newRecoveryCodes, getMfa, enableMfa, newSecret, SSO } from './mfa-helpers.mts';

// A controlled clock: each new code needs a new 30-second step (a code works once).
let clock = Date.now();
Date.now = () => clock;
const tick = () => { clock += 30_000; };

const SITE = 'https://powerguardian.cloud';
const CTRL = 'a'.repeat(64);
const logs: string[] = [];
for (const m of ['log', 'info', 'warn', 'error'] as const) {
  const orig = console[m].bind(console);
  (console as any)[m] = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); if (m === 'log') orig(...a); };
}

seed(
  lic('site-owner', 'owner@x.nl', { claimed_by: CTRL, site_name: 'Acer' }),
  lic('free-lic', 'nosite@x.nl', {}),               // a licence nobody runs: no site yet
);

const cookieOf = (r: Response, name: string) => (r.headers.get('set-cookie') ?? '').match(new RegExp(name + '=([^;]*)'))?.[1] ?? '';
const loc = (r: Response) => new URL(r.headers.get('location') ?? '/', SITE);
async function confirm(email: string, extraCookie = '') {
  const token = await createMagicToken(email);
  return confirmLink(new NextRequest(SITE + '/api/auth/verify', {
    method: 'POST', body: new URLSearchParams({ token }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITE, ...(extraCookie ? { cookie: extraCookie } : {}) },
  }));
}
const step = (id: string) => ({ cookie: 'pg_signin=' + id });
const getStep = (id: string) => stepGet(new Request(SITE + '/login/mfa', { headers: step(id) }));
const postStep = (id: string, fields: Record<string, string>, origin = SITE) => stepPost(new Request(SITE + '/login/mfa', {
  method: 'POST', body: new URLSearchParams(fields).toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin, ...step(id) },
}));
const codeNow = async (secret: Uint8Array) => totpAt(secret, stepOf(Date.now()));
const secretFromPage = (html: string) => unbase32(decodeURIComponent(html.match(/secret=([A-Z2-7]+)/)![1]));

console.log('TOTP (RFC 6238 test vectors, SHA-1)');
const rfc = new TextEncoder().encode('12345678901234567890');
check('T=59 → 94287082', (await totpAt(rfc, Math.floor(59 / 30), 8)) === '94287082');
check('T=1111111109 → 07081804', (await totpAt(rfc, Math.floor(1111111109 / 30), 8)) === '07081804');
check('T=1234567890 → 89005924', (await totpAt(rfc, Math.floor(1234567890 / 30), 8)) === '89005924');
check('T=20000000000 → 65353130', (await totpAt(rfc, Math.floor(20000000000 / 30), 8)) === '65353130');
const s1 = newSecret();
check('base32 round trip', base32(unbase32(base32(s1))) === base32(s1) && base32(s1).length === 32);
const now = Date.now();
check('the current code matches', (await matchTotp(s1, await totpAt(s1, stepOf(now)), now)) === stepOf(now));
check('one step of clock drift either way is accepted', (await matchTotp(s1, await totpAt(s1, stepOf(now) - 1), now)) !== null && (await matchTotp(s1, await totpAt(s1, stepOf(now) + 1), now)) !== null);
check('two steps off is refused', (await matchTotp(s1, await totpAt(s1, stepOf(now) - 2), now)) === null);
check('a code already used (same step) is refused', (await matchTotp(s1, await totpAt(s1, stepOf(now)), now, stepOf(now))) === null);

console.log('\nsecrets and recovery codes at rest');
const sealed = await sealSecret('a@x.nl', s1);
check('the secret is sealed (not the key in clear)', !sealed.includes(base32(s1)) && base32((await openSecret('a@x.nl', sealed))!) === base32(s1));
check('a sealed secret does not open for another account', (await openSecret('b@x.nl', sealed)) === null);
const rc = newRecoveryCodes();
check('10 recovery codes like abcde-fghij, all different', rc.length === 10 && rc.every((c) => /^[a-z2-7]{5}-[a-z2-7]{5}$/.test(c)) && new Set(rc).size === 10);

console.log('\nsign-in: account without sites and without two-step');
let r = await confirm('nosite@x.nl');
check('goes straight to /account with a session', r.status === 303 && loc(r).pathname === '/account' && !!cookieOf(r, 'pg_session'));
check('that session did not pass two-step', (await getSessionInfo(decodeURIComponent(cookieOf(r, 'pg_session'))))?.mfa === false);

console.log('\nsign-in: account with a site must set up two-step first');
r = await confirm('owner@x.nl');
const sid1 = cookieOf(r, 'pg_signin');
check('goes to /login/mfa, NO session yet', r.status === 303 && loc(r).pathname === '/login/mfa' && !!sid1 && !cookieOf(r, 'pg_session'));
check('the step cookie only goes to /login/mfa, HttpOnly, Secure', /Path=\/login\/mfa/i.test(r.headers.get('set-cookie')!) && /HttpOnly/i.test(r.headers.get('set-cookie')!) && /Secure/i.test(r.headers.get('set-cookie')!));
let page = await getStep(sid1);
let html = await page.text();
check('the setup page shows a QR code, an "Add to authenticator app" otpauth button and the key',
  page.status === 200 && html.includes('<svg') && /href="otpauth:\/\/totp\/PowerGuardian%3Aowner%40x.nl\?secret=[A-Z2-7]+&amp;issuer=PowerGuardian/.test(html) && html.includes('Add to authenticator app') && html.includes('id="mfa-key"'));
check('the code field is paste-friendly: inputmode=numeric, autocomplete=one-time-code', /inputmode="numeric"/.test(html) && /autocomplete="one-time-code"/.test(html));
const ownerSecret = secretFromPage(html);
check('reloading the page shows the same key', base32(secretFromPage(await (await getStep(sid1)).text())) === base32(ownerSecret));
r = await postStep(sid1, { code: '000000' });
check('a wrong code: stays on the page with a message, no session', r.status === 401 && (await r.text()).includes('That code did not work') && !cookieOf(r, 'pg_session'));
const setupCode = await codeNow(ownerSecret);
r = await postStep(sid1, { code: setupCode.replace(/(\d{3})/, '$1 ') }); // pasted as "123 456"
html = await r.text();
const codes = [...html.matchAll(/<li>([a-z2-7]{5}-[a-z2-7]{5})<\/li>/g)].map((m) => m[1]);
check('the right code (pasted with a space) turns it on and shows 10 recovery codes once', r.status === 200 && codes.length === 10 && html.includes('Save your recovery codes'));
const ownerCookie = decodeURIComponent(cookieOf(r, 'pg_session'));
check('…and signs in with a session that passed two-step', (await getSessionInfo(ownerCookie))?.mfa === true);
check('"I saved my recovery codes" continues to /account', html.includes('href="/account"'));
check('the step is used up', (await getStep(sid1)).status === 303);
const rec = await getMfa('owner@x.nl');
check('stored: sealed secret + 10 hashed codes, no code or key in clear', !!rec && rec.recovery.length === 10 && !JSON.stringify(rec).includes(codes[0]) && !kv.get('mfa:owner@x.nl')!.includes(base32(ownerSecret)));

console.log('\nsign-in: account with two-step');
r = await confirm('owner@x.nl');
const sid2 = cookieOf(r, 'pg_signin');
html = await (await getStep(sid2)).text();
check('asks "Enter the 6-digit code from your authenticator app", no QR', html.includes('Enter the 6-digit code from your authenticator app') && !html.includes('id="mfa-qr"') && html.includes('Use a recovery code'));
r = await postStep(sid2, { code: setupCode });
check('the code that was already used at setup is refused (works once)', r.status === 401);
tick();
r = await postStep(sid2, { code: await codeNow(ownerSecret) });
check('a fresh code signs in → /account, session passed two-step', r.status === 303 && loc(r).pathname === '/account' && (await getSessionInfo(decodeURIComponent(cookieOf(r, 'pg_session'))))?.mfa === true);

r = await confirm('owner@x.nl');
const sid3 = cookieOf(r, 'pg_signin');
r = await postStep(sid3, { recovery: codes[0].toUpperCase() });
html = await r.text();
check('a recovery code signs in (any case) and says how many are left', r.status === 200 && html.includes('id="mfa-left">9<') && !!cookieOf(r, 'pg_session'));
r = await confirm('owner@x.nl');
const sid4 = cookieOf(r, 'pg_signin');
r = await postStep(sid4, { recovery: codes[0] });
check('the same recovery code does not work twice', r.status === 401);

console.log('\nlimits and checks');
for (let i = 0; i < 4; i++) r = await postStep(sid4, { code: '111111' });
check('after 5 wrong codes the sign-in ends: /login?error=codes', r.status === 303 && loc(r).pathname === '/login' && loc(r).searchParams.get('error') === 'codes');
check('…and that step is gone', (await getStep(sid4)).status === 303);
r = await confirm('owner@x.nl');
const sid5 = cookieOf(r, 'pg_signin');
r = await postStep(sid5, { code: await codeNow(ownerSecret) }, 'https://evil.example');
check('a POST from another site is refused', r.status === 403 && !cookieOf(r, 'pg_session'));
r = await getStep('f'.repeat(64));
check('no pending sign-in → /login?error=timeout', loc(r).pathname === '/login' && loc(r).searchParams.get('error') === 'timeout');
// account-wide limit: 10 code tries per 15 minutes across sign-ins
for (const k of [...kv.keys()].filter((k) => k.startsWith('rl:mfa:email:owner@x.nl'))) kv.set(k, '10');
tick();
r = await postStep(sid5, { code: await codeNow(ownerSecret) });
check('over the account limit even a right code is refused → /login?error=codes', loc(r).searchParams.get('error') === 'codes' && !cookieOf(r, 'pg_session'));
for (const k of [...kv.keys()].filter((k) => k.startsWith('rl:mfa:email:'))) kv.delete(k);

console.log('\nSSO: the statement says mfa only when this session passed two-step');
const NONCE = 'f'.repeat(48), RET = 'https://192.168.10.235/api/auth/sso/callback';
const sso = (cookie: string) => ssoPost(new Request(SITE + '/sso/authorize', {
  method: 'POST', body: new URLSearchParams({ controller: CTRL, nonce: NONCE, return: RET }).toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITE, cookie: 'pg_session=' + cookie },
}));
const assertionOf = async (res: Response) => SSO.decode(decodeURIComponent((res.headers.get('location') ?? '').split('assertion=')[1] ?? ''), PUBKEY);
const withMfa = await assertionOf(await sso(ownerCookie));
check('session that passed two-step → mfa: true', withMfa?.mfa === true && withMfa?.controller_id === CTRL);
const plain = await assertionOf(await sso(await createSession('owner@x.nl')));
check('session without two-step → no mfa claim at all', !!plain && !('mfa' in plain));
r = await confirm('owner@x.nl', 'pg_sso_next=' + encodeURIComponent(new URLSearchParams({ controller: CTRL, nonce: NONCE, return: RET }).toString()));
const sid6 = cookieOf(r, 'pg_signin');
check('signing in for a controller still asks the code first', loc(r).pathname === '/login/mfa');
r = await postStep(sid6, { code: await codeNow(ownerSecret) });
check('…then goes back to the authorize page', r.status === 303 && loc(r).pathname === '/sso/authorize' && loc(r).searchParams.get('controller') === CTRL);

console.log('\naccount page card (API)');
const api = (cookie: string, body?: unknown, origin = SITE) => body === undefined
  ? mfaGet(new Request(SITE + '/api/account/mfa', { headers: { cookie: 'pg_session=' + cookie } }))
  : mfaPost(new Request(SITE + '/api/account/mfa', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin, cookie: 'pg_session=' + cookie } }));
const j = async (res: Response) => ({ status: res.status, ...(await res.json()) });
const nosite = await createSession('nosite@x.nl');
let a = await j(await api(nosite));
check('status: off, not required for an account without sites', a.enabled === false && a.required === false);
check('status: required for an account with a site', (await j(await api(ownerCookie))).required === true && (await j(await api(ownerCookie))).enabled === true);
a = await j(await api(nosite, { action: 'start' }));
check('set up: returns a QR (svg), otpauth link and the key', a.status === 200 && a.qr_svg.startsWith('<svg') && a.otpauth.startsWith('otpauth://totp/') && /^[A-Z2-7 ]+$/.test(a.key));
const nsSecret = unbase32(a.key);
a = await j(await api(nosite, { action: 'confirm', code: '000000' }));
check('confirm with a wrong code: refused, still off', a.status === 401 && (await j(await api(nosite))).enabled === false);
a = await j(await api(nosite, { action: 'confirm', code: await codeNow(nsSecret) }));
check('confirm with the right code: on, 10 recovery codes', a.status === 200 && a.enabled === true && a.recovery_codes.length === 10);
check('…and the current session now counts as two-step', (await getSessionInfo(nosite))?.mfa === true);
const nsCodes: string[] = a.recovery_codes;
a = await j(await api(nosite, { action: 'recovery', code: '123456' }));
check('new recovery codes need a right code', a.status === 401);
tick();
a = await j(await api(nosite, { action: 'recovery', code: await codeNow(nsSecret) }));
check('new recovery codes: 10 new ones, the old ones stop working', a.status === 200 && a.recovery_codes.length === 10 && !a.recovery_codes.includes(nsCodes[0]));
a = await j(await api(nosite, { action: 'remove', code: nsCodes[1] }));
check('an old recovery code cannot turn it off', a.status === 401);
a = await j(await api(nosite, { action: 'remove', code: '' }));
check('turning off without a code is refused', a.status === 401 && (await j(await api(nosite))).enabled === true);
tick();
a = await j(await api(nosite, { action: 'remove', code: await codeNow(nsSecret) }));
check('turning off with a current code works', a.status === 200 && a.enabled === false && (await getMfa('nosite@x.nl')) === null);
a = await j(await api(nosite, { action: 'start' }, 'https://evil.example'));
check('cross-site calls are refused', a.status === 403);
check('signed-out calls are refused', (await api('', undefined)).status === 401);
check('enableMfa refuses a wrong code', (await enableMfa('z@x.nl', newSecret(), '000000')) === null);

console.log('\nnothing secret in the logs');
check('no log line has a key, a code or a recovery code', !logs.some((l) => l.includes(base32(ownerSecret)) || codes.some((c) => l.includes(c)) || l.includes(base32(nsSecret))));

done();
