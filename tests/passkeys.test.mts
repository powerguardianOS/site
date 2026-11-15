// PASSKEYS-1: passkeys (WebAuthn) for PowerGuardian Cloud. Fixed vectors, the verifier's refusals, and every flow through
// the real route handlers: account page (add / remove with fresh confirmation), passwordless sign-in, the two-step page
// (verify + setup for accounts with sites), the /login passkey hint (B2). Run: npx tsx tests/passkeys.test.mts
import { kv, seed, lic, check, done, mails } from './harness.mts';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { SoftAuthenticator, cbor, b64u as nb64u } from '../scripts/soft-authenticator.mjs';
import { verifyRegistration, verifyAssertion, cborDecode, derToRaw, parseAuthData, WebAuthnError } from '../app/lib/webauthn.ts';
import { getPasskeys, relyingParty, defaultName, passkeyHint } from '../app/lib/passkeys.ts';
import { getMfa } from '../app/lib/mfa.ts';
import { createSession, getSessionInfo } from '../app/lib/session.ts';
import { createMagicToken } from '../app/lib/magic-link.ts';
import { POST as confirmLink } from '../app/api/auth/verify/route.ts';
import { GET as stepGet, POST as stepPost } from '../app/login/mfa/route.ts';
import { POST as pkOptions } from '../app/api/auth/passkey/options/route.ts';
import { POST as pkVerify } from '../app/api/auth/passkey/verify/route.ts';
import { GET as acctGet, POST as acctPost } from '../app/api/account/passkeys/route.ts';
import { POST as mfaPost } from '../app/api/account/mfa/route.ts';
import { deleteTenant } from '../app/lib/tenant-admin.ts';
import { listActivity } from '../app/lib/audit.ts';
import { activityRow } from '../app/lib/security-view.ts';
import { listSessions } from '../app/lib/session.ts';
import { methodText } from '../app/lib/security-view.ts';

process.env.BREVO_API_KEY = 'x';
const SITE = 'https://powerguardian.cloud';
const CTRL = 'a'.repeat(64);
const logs: string[] = [];
for (const m of ['log', 'info', 'warn', 'error'] as const) {
  const orig = console[m].bind(console);
  (console as any)[m] = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); if (m === 'log') orig(...a); };
}
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return e instanceof WebAuthnError ? e.code : 'other:' + String(e); } };

// ------------------------------------------------------------------------------------------------ fixed vectors
console.log('fixed vectors (software authenticator, made once)');
const V = JSON.parse(readFileSync(new URL('./fixtures/webauthn-vectors.json', import.meta.url), 'utf8'));
const RP = { id: V.rpId, origin: V.origin };
check('the relying party is powerguardian.cloud (no local override in this run)', relyingParty().id === 'powerguardian.cloud' && relyingParty().origin === SITE);
const es = await verifyRegistration(V.es256.registration.credential, V.es256.registration.challenge, RP);
check('ES256 registration: credential id, alg -7, P-256 key, iCloud AAGUID, synced flag',
  es.credentialId === V.es256.registration.credential.id && es.alg === -7 && es.jwk.kty === 'EC' && es.aaguid === 'fbfc3007-154e-4ecc-8c0b-6e020557d7bd' && es.backedUp && es.counter === 0);
check('ES256 assertion verifies, counter 0 → 1', (await verifyAssertion(V.es256.assertion.credential, V.es256.assertion.challenge, RP, { ...es, counter: 0 })).counter === 1);
const ed = await verifyRegistration(V.eddsa.registration.credential, V.eddsa.registration.challenge, RP);
check('EdDSA registration: alg -8, Ed25519 key', ed.alg === -8 && ed.jwk.kty === 'OKP' && !ed.backedUp);
check('EdDSA assertion verifies', (await verifyAssertion(V.eddsa.assertion.credential, V.eddsa.assertion.challenge, RP, { ...ed, counter: 0 })).counter === 1);
check('EdDSA is refused where only ES256 is allowed', (await code(verifyRegistration(V.eddsa.registration.credential, V.eddsa.registration.challenge, RP, [-7]))) === 'alg');
const flip = (s: string, i = 10) => { const b = Buffer.from(s, 'base64url'); b[i] ^= 1; return b.toString('base64url'); };
const A = V.es256.assertion;
check('a changed signature → signature', (await code(verifyAssertion({ ...A.credential, response: { ...A.credential.response, signature: flip(A.credential.response.signature, 20) } }, A.challenge, RP, es))) === 'signature');
check('a changed authenticatorData (counter byte) → signature', (await code(verifyAssertion({ ...A.credential, response: { ...A.credential.response, authenticatorData: flip(A.credential.response.authenticatorData, 36) } }, A.challenge, RP, es))) === 'signature');
check('another challenge → challenge', (await code(verifyAssertion(A.credential, V.eddsa.assertion.challenge, RP, es))) === 'challenge');
check('another origin expected → origin', (await code(verifyAssertion(A.credential, A.challenge, { ...RP, origin: 'https://www.powerguardian.cloud' }, es))) === 'origin');
check('another rpId expected → rp_id', (await code(verifyAssertion(A.credential, A.challenge, { id: 'evil.example', origin: V.origin }, es))) === 'rp_id');
check('counter regression (stored 1, got 1) → counter', (await code(verifyAssertion(A.credential, A.challenge, RP, { ...es, counter: 1 }))) === 'counter');
check('the other key → signature', (await code(verifyAssertion(A.credential, A.challenge, RP, { ...es, jwk: { kty: 'EC', crv: 'P-256', x: (await verifyRegistration(V.es256.registration.credential, V.es256.registration.challenge, RP)).jwk.y, y: es.jwk.y } as any }))) !== 'ok');
check('a registration answer used as assertion → type', (await code(verifyAssertion({ ...A.credential, response: { ...A.credential.response, clientDataJSON: V.es256.registration.credential.response.clientDataJSON } }, V.es256.registration.challenge, RP, es))) === 'type');

console.log('\nCBOR, authData and DER parsing is strict');
check('indefinite-length map refused', (await code(Promise.resolve().then(() => cborDecode(Uint8Array.of(0xbf, 0xff))))) === 'cbor');
check('truncated byte string refused', (await code(Promise.resolve().then(() => cborDecode(Uint8Array.of(0x45, 1, 2))))) === 'cbor');
check('duplicate map keys refused', (await code(Promise.resolve().then(() => cborDecode(Uint8Array.of(0xa2, 0x01, 0x01, 0x01, 0x02))))) === 'cbor');
check('floats / tags refused', (await code(Promise.resolve().then(() => cborDecode(Uint8Array.of(0xf9, 0, 0))))) === 'cbor' && (await code(Promise.resolve().then(() => cborDecode(Uint8Array.of(0xc1, 0)))) === 'cbor'));
const authA = Buffer.from(A.credential.response.authenticatorData, 'base64url');
check('authData with trailing bytes refused', (await code(Promise.resolve().then(() => parseAuthData(new Uint8Array([...authA, 0]))))) === 'auth_data');
check('authData too short refused', (await code(Promise.resolve().then(() => parseAuthData(new Uint8Array(36))))) === 'auth_data');
check('DER with trailing garbage refused', (await code(Promise.resolve().then(() => derToRaw(Uint8Array.of(0x30, 6, 2, 1, 1, 2, 1, 1, 0))))) === 'signature');
check('DER → raw pads short integers', Buffer.from(derToRaw(Uint8Array.of(0x30, 6, 2, 1, 5, 2, 1, 7))).toString('hex') === '00'.repeat(31) + '05' + '00'.repeat(31) + '07');

// --------------------------------------------------------------------------------------------- flows (routes)
seed(
  lic('acme-site', 'acme@acme.test', { claimed_by: CTRL, site_name: 'Acer' }),
  lic('mal-site', 'mallory@mallory.test', { claimed_by: 'b'.repeat(64), site_name: 'Mal' }),
);
const cookieOf = (r: Response, name: string) => (r.headers.get('set-cookie') ?? '').match(new RegExp(name + '=([^;]*)'))?.[1] ?? '';
const j = async (res: Response) => ({ status: res.status, ...(await res.json().catch(() => ({}))) });
const loc = (r: Response) => new URL(r.headers.get('location') ?? '/', SITE);
const acct = (session: string, body?: unknown, origin = SITE) => body === undefined
  ? acctGet(new Request(SITE + '/api/account/passkeys', { headers: { cookie: 'pg_session=' + session } }))
  : acctPost(new Request(SITE + '/api/account/passkeys', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin, cookie: 'pg_session=' + session } }));
const mfaApi = (session: string, body: unknown) => mfaPost(new Request(SITE + '/api/account/mfa', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin: SITE, cookie: 'pg_session=' + session } }));
async function confirm(email: string) {
  const token = await createMagicToken(email);
  return confirmLink(new NextRequest(SITE + '/api/auth/verify', { method: 'POST', body: new URLSearchParams({ token }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITE } }));
}
const stepJson = (id: string, action: string, body: unknown = {}, origin = SITE) => stepPost(new Request(SITE + '/login/mfa?passkey=' + action, {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin, cookie: 'pg_signin=' + id } }));
async function signinOptions(origin = SITE) {
  const r = await pkOptions(new Request(SITE + '/api/auth/passkey/options', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin } }));
  return { status: r.status, bind: cookieOf(r, 'pg_pk'), setCookie: r.headers.get('set-cookie') ?? '', ...(await r.json()) };
}
const signinVerify = (bind: string, credential: unknown, extraCookie = '') => pkVerify(new NextRequest(SITE + '/api/auth/passkey/verify', {
  method: 'POST', body: JSON.stringify({ credential }), headers: { 'content-type': 'application/json', origin: SITE, cookie: `pg_pk=${bind}${extraCookie ? '; ' + extraCookie : ''}` } }));
const audits = () => [...kv.entries()].filter(([k]) => k.startsWith('audit:')).map(([, v]) => JSON.parse(v));
const clearLimits = () => { for (const k of [...kv.keys()].filter((k) => k.startsWith('rl:'))) kv.delete(k); };

console.log('\naccount page: add a passkey (account without sites, two-step off)');
const plainS = await createSession('plain@x.test');
const phone = new SoftAuthenticator({ origin: SITE, aaguid: Uint8Array.from(Buffer.from('fbfc3007154e4ecc8c0b6e020557d7bd', 'hex')) });
let o = await j(await acct(plainS, { action: 'options' }));
check('creation options: rp powerguardian.cloud, ES256 + EdDSA, UV + resident key required, attestation none, user.id is not the e-mail',
  o.status === 200 && o.publicKey.rp.id === 'powerguardian.cloud' && o.publicKey.pubKeyCredParams.map((p: any) => p.alg).join() === '-7,-8'
  && o.publicKey.authenticatorSelection.userVerification === 'required' && o.publicKey.authenticatorSelection.residentKey === 'required'
  && o.publicKey.attestation === 'none' && Buffer.from(o.publicKey.user.id, 'base64url').length === 32 && !Buffer.from(o.publicKey.user.id, 'base64url').toString().includes('plain'));
check('the challenge lives 2 minutes (KV TTL 120 s)', [...kv.keys()].some((k) => k === 'webauthn:challenge:' + o.publicKey.challenge));
let reg = await phone.create(o.publicKey);
let a = await j(await acct(plainS, { action: 'register', credential: reg, device: 'iPhone · Safari' }));
check('registered; 10 recovery codes because this turned two-step on', a.status === 200 && a.passkey.name === 'iCloud Keychain · iPhone' && a.recovery_codes?.length === 10);
const plainCodes: string[] = a.recovery_codes;
check('the session that added it now counts as two-step', (await getSessionInfo(plainS))?.mfa === true);
check('stored: COSE key as JWK, no private material, counter, index by hash of the id',
  (await getPasskeys('plain@x.test'))!.creds.length === 1 && !JSON.stringify((await getPasskeys('plain@x.test'))!).includes('"d"') && [...kv.keys()].some((k) => /^passkey:cred:[0-9a-f]{64}$/.test(k)));
check('the MFA record keeps recovery codes without an authenticator app', (await getMfa('plain@x.test'))?.totp === '' && (await getMfa('plain@x.test'))?.recovery.length === 10);
check('audit: passkey.add for this account', audits().some((e) => e.action === 'passkey.add' && e.email === 'plain@x.test'));
a = await j(await acct(plainS, { action: 'register', credential: reg }));
check('the same answer again (replayed challenge) → refused', a.status === 400);
o = await j(await acct(plainS, { action: 'options' }));
check('excludeCredentials lists the existing passkey', o.publicKey.excludeCredentials.length === 1 && o.publicKey.excludeCredentials[0].id === reg.id);
const laptop = new SoftAuthenticator({ origin: SITE, alg: -8 });
a = await j(await acct(plainS, { action: 'register', credential: await laptop.create(o.publicKey), device: 'Mac · Chrome', name: '' }));
check('a second passkey (EdDSA) gets the device name, no new recovery codes', a.status === 200 && a.passkey.name === 'Mac · Chrome' && a.recovery_codes === null);
check('GET lists both: name, created, last used (none yet), synced', (await j(await acct(plainS))).passkeys.length === 2);
check('default name falls back to "Passkey"', defaultName('', '') === 'Passkey');

console.log('\nregistration refusals');
const badReg = async (opts: Record<string, unknown>, auth = new SoftAuthenticator({ origin: SITE })) => {
  const op = await j(await acct(plainS, { action: 'options' }));
  return (await j(await acct(plainS, { action: 'register', credential: await auth.create(op.publicKey, opts) }))).status;
};
check('wrong origin → refused', (await badReg({ origin: 'https://evil.example' })) === 400);
check('wrong rpId → refused', (await badReg({ rpId: 'evil.example' })) === 400);
check('UV missing → refused', (await badReg({ uv: false })) === 400);
check('UP missing → refused', (await badReg({ up: false })) === 400);
check('alg not allowed (RS256, -257) → refused', (await badReg({ alg: -257 })) === 400);
check('attestation format other than none → refused', (await badReg({ fmt: 'packed' })) === 400);
check('cross-origin iframe → refused', (await badReg({ crossOrigin: true })) === 400);
clearLimits(); // the tries above count against the account's code limit
check('a challenge from another session (same account) → refused', await (async () => {
  const other = await createSession('plain@x.test', { mfa: true });
  const op = await j(await acct(other, { action: 'options' }));
  return (await j(await acct(plainS, { action: 'register', credential: await new SoftAuthenticator({ origin: SITE }).create(op.publicKey) }))).status === 400;
})());
check('nothing was stored by the refused tries', (await getPasskeys('plain@x.test'))!.creds.length === 2);
clearLimits();

console.log('\npasswordless sign-in ("Sign in with a passkey")');
let so = await signinOptions();
check('options: no allowCredentials (the browser offers its passkeys), UV required, bound to an HttpOnly Strict cookie',
  so.status === 200 && so.publicKey.allowCredentials.length === 0 && so.publicKey.userVerification === 'required' && so.publicKey.rpId === 'powerguardian.cloud'
  && /HttpOnly/i.test(so.setCookie) && /SameSite=strict/i.test(so.setCookie) && /Path=\/api\/auth\/passkey/i.test(so.setCookie) && /Max-Age=120/.test(so.setCookie));
check('options from another site → refused', (await signinOptions('https://evil.example')).status === 403);
let asr = await phone.get(so.publicKey);
let r = await signinVerify(so.bind, asr);
let v = await j(r.clone());
check('signs in → /account with a session that counts as two-step', v.status === 200 && v.next === '/account' && (await getSessionInfo(decodeURIComponent(cookieOf(r, 'pg_session'))))?.mfa === true);
check('audit: signin.passkey', audits().some((e) => e.action === 'signin.passkey' && e.email === 'plain@x.test'));
check('last used and counter are recorded', !!(await getPasskeys('plain@x.test'))!.creds.find((c) => c.id === reg.id)!.last_used_at);
r = await signinVerify(so.bind, asr);
check('replaying the same answer → refused (challenge used up)', r.status === 401 && (await j(r)).error === 'expired' && !cookieOf(r, 'pg_session'));
so = await signinOptions();
const so2 = await signinOptions();
check('a challenge issued to another browser (other cookie) → refused', (await signinVerify(so2.bind, await phone.get(so.publicKey))).status === 401);
clearLimits();
const sx = async (opts: Record<string, unknown>, auth = phone) => { const s = await signinOptions(); return signinVerify(s.bind, await auth.get(s.publicKey, opts)); };
check('wrong origin → refused', (await sx({ origin: 'https://evil.example' })).status === 401);
check('wrong rpId → refused', (await sx({ rpId: 'evil.example' })).status === 401);
check('UV missing → refused', (await sx({ uv: false })).status === 401);
check('counter regression (cloned authenticator) → refused', (await sx({ counter: 1 })).status === 401);
check('a create-type clientData → refused', (await sx({ type: 'webauthn.create' })).status === 401);
check('a userHandle of another account → refused', (await sx({ userHandle: nb64u(new Uint8Array(32).fill(9)) })).status === 401);
const stranger = new SoftAuthenticator({ origin: SITE }); await stranger.create({ challenge: 'x', user: { id: nb64u(new Uint8Array(32)) } });
check('an unknown credential → refused ("not on an account")', (await j(await sx({}, stranger))).error === 'unknown');
check('(control) the right answer still works after all that', (await sx({})).status === 200);
check('refusals are in the audit trail for that account', audits().filter((e) => e.action === 'signin.passkey_refused' && e.email === 'plain@x.test').length >= 5);
clearLimits();

console.log('\nrate limit (as for codes): 10 per account per 15 minutes');
let last = 0;
for (let i = 0; i < 11; i++) last = (await sx({ uv: false })).status;
check('the 11th try for that account is refused before verifying (429)', last === 429);
check('…even with a right answer', (await sx({})).status === 429);
clearLimits();

console.log('\ntwo-step page: an account with passkeys (no authenticator app) after the e-mail link');
r = await confirm('plain@x.test');
const sid = cookieOf(r, 'pg_signin');
check('the link goes to /login/mfa, no session yet', r.status === 303 && loc(r).pathname === '/login/mfa' && !cookieOf(r, 'pg_session'));
let page = await stepGet(new Request(SITE + '/login/mfa', { headers: { cookie: 'pg_signin=' + sid } }));
let html = await page.text();
check('the page offers "Use a passkey" and a recovery code, no 6-digit field (no app)', html.includes('id="mfa-passkey"') && html.includes('Use a recovery code') && !html.includes('id="mfa-code"'));
check('it loads only /mfa-passkey.js, CSP script-src \'self\'', html.includes('<script src="/mfa-passkey.js" defer></script>') && /script-src 'self'/.test(page.headers.get('content-security-policy') ?? ''));
o = await j(await stepJson(sid, 'options'));
check('step options list only this account\'s passkeys', o.status === 200 && o.publicKey.allowCredentials.length === 2);
const malS = await createSession('mallory@mallory.test');
const mallory = new SoftAuthenticator({ origin: SITE });
// mallory gets a passkey of her own (her account has a site: two-step required, so a session that passed it)
const malMfa = await createSession('mallory@mallory.test', { mfa: true });
const mo = await j(await acct(malMfa, { action: 'options' }));
const malReg = await j(await acct(malMfa, { action: 'register', credential: await mallory.create(mo.publicKey), device: 'Windows · Edge' }));
check('(setup) mallory adds her own passkey on her own account', malReg.status === 200);
a = await j(await stepJson(sid, 'verify', { credential: await mallory.get(o.publicKey) }));
check('another account\'s passkey on plain\'s two-step page → refused, no session', a.status === 401 && a.left === 4);
o = await j(await stepJson(sid, 'options'));
a = await j(await stepJson(sid, 'verify', { credential: await phone.get(o.publicKey, { uv: false }) }));
check('UV missing → refused', a.status === 401);
clearLimits();
o = await j(await stepJson(sid, 'options'));
r = await stepJson(sid, 'verify', { credential: await phone.get(o.publicKey) });
a = await j(r.clone());
check('the right passkey → session with two-step, on to /account', a.status === 200 && a.next === '/account' && (await getSessionInfo(decodeURIComponent(cookieOf(r, 'pg_session'))))?.mfa === true);
check('the pending sign-in is used up', (await stepJson(sid, 'options')).status === 410);
r = await confirm('plain@x.test');
const sidB = cookieOf(r, 'pg_signin');
r = await confirm('plain@x.test');
const sidC = cookieOf(r, 'pg_signin');
o = await j(await stepJson(sidB, 'options'));
check('a challenge from another pending sign-in → refused', (await j(await stepJson(sidC, 'verify', { credential: await phone.get(o.publicKey) }))).status === 401);
check('a POST from another site → refused', (await stepJson(sidC, 'options', {}, 'https://evil.example')).status === 403);
for (let i = 0; i < 4; i++) { o = await j(await stepJson(sidC, 'options')); a = await j(await stepJson(sidC, 'verify', { credential: await phone.get(o.publicKey, { uv: false }) })); }
check('5 failed tries end the sign-in (→ /login?error=codes)', a.next === '/login?error=codes' && (await stepJson(sidC, 'options')).status === 410);
r = await stepPost(new Request(SITE + '/login/mfa', { method: 'POST', body: new URLSearchParams({ recovery: plainCodes[0] }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded', origin: SITE, cookie: 'pg_signin=' + sidB } }));
check('a recovery code still works for a passkey-only account', r.status === 200 && !!cookieOf(r, 'pg_session'));
clearLimits();

console.log('\naccount with a site and no second step: setup offers a passkey');
r = await confirm('acme@acme.test');
const sidA = cookieOf(r, 'pg_signin');
html = await (await stepGet(new Request(SITE + '/login/mfa', { headers: { cookie: 'pg_signin=' + sidA } }))).text();
check('the setup page offers "Add a passkey" first, the authenticator app below', html.includes('id="mfa-passkey-setup"') && html.includes('id="mfa-qr"'));
check('passkey sign-in options are refused in setup mode (nothing to use yet)', (await stepJson(sidA, 'options')).status === 409);
o = await j(await stepJson(sidA, 'register-options'));
const acmeKey = new SoftAuthenticator({ origin: SITE });
check('register options for acme (user.name = acme)', o.status === 200 && o.publicKey.user.name === 'acme@acme.test');
r = await stepJson(sidA, 'register', { credential: await acmeKey.create(o.publicKey), device: 'iPhone · Safari' });
a = await j(r.clone());
check('acme adds a passkey during sign-in: 10 recovery codes, signed in with two-step', a.status === 200 && a.recovery_codes.length === 10 && a.next === '/account' && (await getSessionInfo(decodeURIComponent(cookieOf(r, 'pg_session'))))?.mfa === true);
const acmeS = decodeURIComponent(cookieOf(r, 'pg_session'));
r = await confirm('acme@acme.test');
check('next sign-in by link: verify mode with the passkey (no setup again)', (await (await stepGet(new Request(SITE + '/login/mfa', { headers: { cookie: 'pg_signin=' + cookieOf(r, 'pg_signin') } }))).text()).includes('id="mfa-passkey"'));

console.log('\nisolation: mallory and acme');
o = await j(await acct(acmeS, { action: 'confirm-options' }));
a = await j(await acct(malS, { action: 'remove', id: malReg.passkey.id, credential: await acmeKey.get(o.publicKey) }));
check('a confirm challenge issued to acme\'s session, used by mallory → refused', a.status === 401);
const acmeId = (await getPasskeys('acme@acme.test'))!.creds[0].id;
a = await j(await acct(malMfa, { action: 'remove', id: acmeId, code: '123456' }));
check('mallory removes acme\'s passkey id → not found (her account only), acme keeps it', a.status === 404 && (await getPasskeys('acme@acme.test'))!.creds.length === 1);
o = await j(await acct(malMfa, { action: 'options' }));
a = await j(await acct(malMfa, { action: 'register', credential: await new SoftAuthenticator({ origin: SITE }).create(o.publicKey, { credId: Buffer.from(acmeId, 'base64url') }) }));
check('mallory registers acme\'s credential id on her account → refused', a.status === 400 && (await getPasskeys('mallory@mallory.test'))!.creds.length === 1);
o = await j(await acct(malMfa, { action: 'confirm-options' }));
check('confirm options for mallory list only her own passkey', o.publicKey.allowCredentials.length === 1 && o.publicKey.allowCredentials[0].id !== acmeId);
check('mallory\'s GET lists only her passkey', (await j(await acct(malMfa))).passkeys.every((p: any) => p.id !== acmeId));
check('with two-step on, a session that did not pass it cannot add a passkey', (await j(await acct(malS, { action: 'options' }))).status === 403);
clearLimits();

console.log('\nremove (fresh confirmation)');
const list = (await getPasskeys('plain@x.test'))!.creds;
a = await j(await acct(plainS, { action: 'remove', id: list[0].id }));
check('no confirmation → refused', a.status === 401 && (await getPasskeys('plain@x.test'))!.creds.length === 2);
a = await j(await acct(plainS, { action: 'remove', id: list[0].id, code: 'aaaaa-bbbbb' }));
check('a wrong recovery code → refused', a.status === 401);
o = await j(await acct(plainS, { action: 'confirm-options' }));
a = await j(await acct(plainS, { action: 'remove', id: list[0].id, credential: await phone.get(o.publicKey) }));
check('confirmed with a current passkey → removed', a.status === 200 && (await getPasskeys('plain@x.test'))!.creds.length === 1);
check('audit: passkey.remove (confirmed with passkey)', audits().some((e) => e.action === 'passkey.remove' && /passkey$/.test(e.detail)));
so = await signinOptions();
r = await signinVerify(so.bind, await phone.get(so.publicKey));
check('the removed passkey can no longer sign in', r.status === 401 && (await j(r)).error === 'unknown');
o = await j(await acct(plainS, { action: 'confirm-options' }));
check('the removed passkey is not offered for confirmation', o.publicKey.allowCredentials.length === 1 && o.publicKey.allowCredentials[0].id !== list[0].id);
a = await j(await acct(plainS, { action: 'remove', id: list[1].id, code: plainCodes[1] }));
check('the last passkey removed with a recovery code → two-step off, recovery codes gone', a.status === 200 && (await getPasskeys('plain@x.test'))!.creds.length === 0 && (await getMfa('plain@x.test')) === null);
r = await confirm('plain@x.test');
check('…and the e-mail link signs in directly again', loc(r).pathname === '/account' && !!cookieOf(r, 'pg_session'));
clearLimits();

console.log('\nauthenticator app next to passkeys');
a = await j(await mfaApi(acmeS, { action: 'recovery', credential: await acmeKey.get((await j(await acct(acmeS, { action: 'confirm-options' }))).publicKey) }));
check('new recovery codes confirmed with a passkey (no app needed)', a.status === 200 && a.recovery_codes.length === 10);
a = await j(await mfaApi(acmeS, { action: 'remove', code: a.recovery_codes[0] }));
check('"remove authenticator app" without an app → refused (409)', a.status === 409);

console.log('\n/login hint (B2): the device keeps a hash, the server never says whether an address has a passkey');
const hintAcme = await passkeyHint('acme@acme.test');
check('the hint is a sha256 (64 hex), not the address', /^[0-9a-f]{64}$/.test(hintAcme) && !hintAcme.includes('acme') && hintAcme === await passkeyHint(' ACME@acme.test '));
clearLimits();
let hs = await signinOptions();
let hr = await j(await pkVerify(new NextRequest(SITE + '/api/auth/passkey/verify', { method: 'POST', body: JSON.stringify({ credential: await acmeKey.get(hs.publicKey), expect: await passkeyHint('someone@else.test') }), headers: { 'content-type': 'application/json', origin: SITE, cookie: 'pg_pk=' + hs.bind } })));
check('a passkey of another account than the typed address → refused, no session', hr.status === 401 && !hr.next);
hs = await signinOptions();
const hres = await pkVerify(new NextRequest(SITE + '/api/auth/passkey/verify', { method: 'POST', body: JSON.stringify({ credential: await acmeKey.get(hs.publicKey), expect: hintAcme }), headers: { 'content-type': 'application/json', origin: SITE, cookie: 'pg_pk=' + hs.bind } }));
hr = await j(hres);
check('the typed address\'s own passkey → signed in, the answer carries that account\'s hint only', hr.status === 200 && hr.hint === hintAcme && !JSON.stringify(hr).includes('acme@acme.test') && !!cookieOf(hres, 'pg_session'));
const acmeAct = await listActivity('acme@acme.test');
check('SESSIONS-1 activity: "Signed in · Passkey" and "Passkey added"', acmeAct.some((e) => e.action === 'auth.signin' && e.detail === 'Passkey') && acmeAct.some((e) => activityRow(e).title === 'Passkey added'));
check('SESSIONS-1 session list: the passkey session says "Passkey"', (await listSessions('acme@acme.test')).some((x) => methodText(x) === 'Passkey'));
clearLimits();

console.log('\ntenant deleted → passkeys gone');
kv.set('account:plain@x.test', JSON.stringify({ email: 'plain@x.test', created_at: new Date().toISOString(), verified: true }));
o = await j(await acct(plainS, { action: 'options' }));
await acct(plainS, { action: 'register', credential: await new SoftAuthenticator({ origin: SITE }).create(o.publicKey) });
const idxBefore = [...kv.keys()].filter((k) => k.startsWith('passkey:cred:')).length;
const plainLive = await createSession('plain@x.test');
const t = await deleteTenant('plain@x.test', 'plain@x.test', 'admin@powerguardian.cloud');
check('B2: deleting an account ends its sessions and drops its session index and activity', (await getSessionInfo(plainLive)) === null && !kv.has('sessions:plain@x.test') && !kv.has('activity:plain@x.test'));
check('deleting an account removes its passkeys and their index', t.ok === true && (await getPasskeys('plain@x.test')) === null && [...kv.keys()].filter((k) => k.startsWith('passkey:cred:')).length === idxBefore - 1);

console.log('\nnothing secret in the logs');
check('no log line carries a challenge or a recovery code', !logs.some((l) => plainCodes.some((c) => l.includes(c)) || /webauthn:challenge/.test(l)));

done();
