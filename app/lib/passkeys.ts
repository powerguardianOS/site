// PASSKEYS-1: passkeys for PowerGuardian Cloud accounts (Face ID / Touch ID / Windows Hello / Android, or a phone via
// the browser's own QR flow). A passkey with user verification is passwordless sign-in AND two-step at once: the
// session gets mfa:true, so the SSO statement carries mfa:true as with the authenticator app.
//
// Storage (app/lib/kv.ts only):
//   passkeys:<email>              { v, handle, creds: [{ id, jwk, alg, name, created_at, last_used_at, counter, synced, aaguid }] }
//                                 handle = the WebAuthn user.id: 32 random bytes, never the e-mail.
//   passkey:cred:<sha256(id)>     <email>   (who owns a credential id; a discoverable sign-in only names the credential)
//   webauthn:challenge:<challenge> { purpose, bind, email?, exp }   2 minutes, single use (deleted when taken)
// The binding makes a challenge useless anywhere else: the passwordless sign-in is bound to an HttpOnly cookie of the
// browser that asked, the two-step page to its pending sign-in, the account page to the session (and its e-mail).
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { logAudit } from '@/app/lib/audit';
import { securityMail } from '@/app/lib/security-mail';
import { rateLimited } from '@/app/lib/ratelimit';
import { b64u } from '@/app/lib/keys';
import { APEX_HOST, siteBase } from '@/app/lib/host';
import { getMfa, saveMfa, deleteMfa, newRecoveryCodes, hashRecoveryCodes, redeemCode, codeAttemptsExceeded } from '@/app/lib/mfa';
import {
  verifyRegistration, verifyAssertion, assertionCredentialId, assertionUserHandle, newChallenge, sha256, readClientData,
  WebAuthnError, ALG_ES256, ALG_EDDSA, type PublicJwk, type RegistrationInput, type AssertionInput, type RelyingParty,
} from '@/app/lib/webauthn';

export const CHALLENGE_TTL_S = 120;
export const MAX_PASSKEYS = 10;
export const PK_COOKIE = 'pg_pk';
export const PK_PATH = '/api/auth/passkey';

export type PasskeyCred = {
  id: string; jwk: PublicJwk; alg: number; name: string;
  created_at: string; last_used_at: string | null; counter: number; synced: boolean; aaguid: string;
};
export type PasskeyAccount = { v: 1; handle: string; creds: PasskeyCred[] };
export type PasskeyView = { id: string; name: string; created_at: string; last_used_at: string | null; synced: boolean };

// ---- relying party: powerguardian.cloud. Only a local test setup (localhost / 127.0.0.1) may say otherwise.
export function relyingParty(): RelyingParty {
  const base = siteBase();
  try {
    const u = new URL(base);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return { id: u.hostname, origin: u.origin };
  } catch { /* below */ }
  return { id: APEX_HOST, origin: `https://${APEX_HOST}` };
}

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const accKey = (email: string) => `passkeys:${email.toLowerCase()}`;
const credKey = async (id: string) => `passkey:cred:${hex(await sha256(id))}`;
const chKey = (c: string) => `webauthn:challenge:${c}`;
export const bindHash = async (s: string) => hex(await sha256('pg webauthn bind|' + s));
// B2: what a device that just used or made a passkey keeps, so its /login can offer the passkey for that address
// without asking the server (app/lib/webauthn-client.ts hintOf computes the same in the browser).
export const passkeyHint = async (email: string) => hex(await sha256('pg passkey hint|' + email.trim().toLowerCase()));

export async function getPasskeys(email: string): Promise<PasskeyAccount | null> {
  const raw = await kvGet(accKey(email));
  if (!raw) return null;
  try { const a = JSON.parse(raw) as PasskeyAccount; return a && a.handle && Array.isArray(a.creds) ? a : null; } catch { return null; }
}
const savePasskeys = (email: string, a: PasskeyAccount) => kvPut(accKey(email), JSON.stringify(a));
export async function passkeyCount(email: string): Promise<number> { return (await getPasskeys(email))?.creds.length ?? 0; }
export const viewOf = (c: PasskeyCred): PasskeyView => ({ id: c.id, name: c.name, created_at: c.created_at, last_used_at: c.last_used_at, synced: c.synced });

// Two-step sign-in is on when the account has the authenticator app or at least one passkey.
export async function twoStep(email: string): Promise<{ totp: boolean; passkeys: number; on: boolean }> {
  const [rec, n] = await Promise.all([getMfa(email), passkeyCount(email)]);
  const totp = !!rec?.totp;
  return { totp, passkeys: n, on: totp || n > 0 };
}

// ---- challenges
export type Purpose = 'signin' | 'step' | 'step-register' | 'register' | 'confirm';
type ChallengeRec = { purpose: Purpose; bind: string; email?: string; exp: number };

export async function issueChallenge(purpose: Purpose, bind: string, email?: string, now = Date.now()): Promise<string> {
  const c = newChallenge();
  await kvPut(chKey(c), JSON.stringify({ purpose, bind: await bindHash(bind), ...(email ? { email: email.toLowerCase() } : {}), exp: now + CHALLENGE_TTL_S * 1000 } satisfies ChallengeRec), CHALLENGE_TTL_S);
  return c;
}

// Takes (and deletes) the challenge the browser signed, only when it was issued for this purpose and binding.
// A challenge is gone after one try, right or wrong.
async function takeChallenge(clientDataJSON: unknown, purpose: Purpose, bind: string, email?: string, now = Date.now()): Promise<string> {
  const { data } = readClientData(clientDataJSON);
  if (!/^[A-Za-z0-9_-]{43}$/.test(data.challenge)) throw new WebAuthnError('challenge');
  const raw = await kvGet(chKey(data.challenge));
  if (!raw) throw new WebAuthnError('challenge');
  await kvDel(chKey(data.challenge));
  let rec: ChallengeRec;
  try { rec = JSON.parse(raw); } catch { throw new WebAuthnError('challenge'); }
  if (rec.purpose !== purpose || !(rec.exp > now) || rec.bind !== await bindHash(bind)) throw new WebAuthnError('challenge');
  if (email !== undefined && rec.email !== email.toLowerCase()) throw new WebAuthnError('challenge');
  return data.challenge;
}

// ---- options for navigator.credentials.create / get (JSON; the client turns base64url into bytes)
const PARAMS = [{ type: 'public-key', alg: ALG_ES256 }, { type: 'public-key', alg: ALG_EDDSA }];

// The account's passkey record; the first time, a new user handle is made and kept (the authenticator stores it as
// user.id and sends it back with every sign-in, so it must not change).
async function accountFor(email: string): Promise<PasskeyAccount> {
  const a = await getPasskeys(email);
  if (a) return a;
  const h = new Uint8Array(32); crypto.getRandomValues(h);
  const fresh: PasskeyAccount = { v: 1, handle: b64u(h), creds: [] };
  await savePasskeys(email, fresh);
  return fresh;
}

export async function creationOptions(purpose: 'register' | 'step-register', bind: string, email: string) {
  const acc = await accountFor(email);
  const rp = relyingParty();
  return {
    challenge: await issueChallenge(purpose, bind, email),
    rp: { id: rp.id, name: 'PowerGuardian' },
    user: { id: acc.handle, name: email.toLowerCase(), displayName: email.toLowerCase() },
    pubKeyCredParams: PARAMS,
    timeout: CHALLENGE_TTL_S * 1000,
    attestation: 'none',
    excludeCredentials: acc.creds.map((c) => ({ type: 'public-key', id: c.id })),
    authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
  };
}

export async function requestOptions(purpose: 'signin' | 'step' | 'confirm', bind: string, email?: string) {
  const creds = email ? (await getPasskeys(email))?.creds ?? [] : [];
  return {
    challenge: await issueChallenge(purpose, bind, email),
    rpId: relyingParty().id,
    timeout: CHALLENGE_TTL_S * 1000,
    userVerification: 'required',
    allowCredentials: creds.map((c) => ({ type: 'public-key', id: c.id })),
  };
}

// ---- names: the passkey provider when its AAGUID is well known, else what the browser said about the device
const PROVIDERS: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  '531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
};
export function cleanName(s: unknown): string {
  const t = typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim() : '';
  return t.slice(0, 60);
}
export function defaultName(aaguid: string, device: unknown): string {
  const d = cleanName(device);
  const p = PROVIDERS[aaguid];
  if (p && d) return cleanName(`${p} · ${d.split(' · ')[0]}`);
  return p || d || 'Passkey';
}

// ---- registration (account page, or the two-step setup during a sign-in)
export type RegisterResult = { passkey: PasskeyView; recovery_codes: string[] | null };

export async function finishRegistration(purpose: 'register' | 'step-register', bind: string, email: string, cred: RegistrationInput, name: unknown, device: unknown, now = Date.now()): Promise<RegisterResult> {
  const challenge = await takeChallenge(cred?.response?.clientDataJSON, purpose, bind, email, now);
  const reg = await verifyRegistration(cred, challenge, relyingParty());
  const acc = await accountFor(email);
  if (acc.creds.length >= MAX_PASSKEYS) throw new WebAuthnError('too_many');
  const ck = await credKey(reg.credentialId);
  const owner = await kvGet(ck);
  if (owner || acc.creds.some((c) => c.id === reg.credentialId)) throw new WebAuthnError('cred_exists');
  const at = new Date(now).toISOString();
  const c: PasskeyCred = {
    id: reg.credentialId, jwk: reg.jwk, alg: reg.alg, name: cleanName(name) || defaultName(reg.aaguid, device),
    created_at: at, last_used_at: null, counter: reg.counter, synced: reg.backedUp, aaguid: reg.aaguid,
  };
  const rec = await getMfa(email);
  const firstStep = acc.creds.length === 0 && !rec?.totp; // two-step was off until now
  await kvPut(ck, email.toLowerCase());
  await savePasskeys(email, { ...acc, creds: [...acc.creds, c] });
  return { passkey: viewOf(c), recovery_codes: await ensureRecovery(email, now, firstStep) };
}

// Recovery codes are required with any second step: a new set when two-step is turned on by this passkey, or when the
// account has none left; otherwise the existing codes stay.
export async function ensureRecovery(email: string, now = Date.now(), fresh = false): Promise<string[] | null> {
  const rec = await getMfa(email);
  if (!fresh && rec && rec.recovery.length > 0) return null;
  const codes = newRecoveryCodes();
  const at = new Date(now).toISOString();
  await saveMfa(email, { v: 1, totp: rec?.totp ?? '', created_at: rec?.created_at ?? at, last_step: rec?.last_step ?? 0,
    recovery: await hashRecoveryCodes(email, codes), recovery_created_at: at });
  return codes;
}

// ---- assertion: passwordless sign-in (any account; the credential names it), two-step page and fresh confirmation
// (expectEmail: the credential must belong to that account).
export type AssertResult = { email: string; credId: string; name: string };

export async function finishAssertion(purpose: 'signin' | 'step' | 'confirm', bind: string, cred: AssertionInput, expectEmail?: string, now = Date.now()): Promise<AssertResult> {
  const challenge = await takeChallenge(cred?.response?.clientDataJSON, purpose, bind, purpose === 'signin' ? undefined : expectEmail, now);
  const credId = assertionCredentialId(cred);
  const owner = await kvGet(await credKey(credId));
  if (!owner) throw new WebAuthnError('unknown_credential');
  if (expectEmail !== undefined && owner !== expectEmail.toLowerCase()) throw new WebAuthnError('unknown_credential');
  const acc = await getPasskeys(owner);
  const c = acc?.creds.find((x) => x.id === credId);
  if (!acc || !c) throw new WebAuthnError('unknown_credential'); // removed passkey (index left behind) → refused
  const handle = assertionUserHandle(cred);
  if (handle !== null && handle !== acc.handle) throw new WebAuthnError('user_handle');
  let r: Awaited<ReturnType<typeof verifyAssertion>>;
  try {
    r = await verifyAssertion(cred, challenge, relyingParty(), c);
  } catch (e) {
    if (e instanceof WebAuthnError && e.code === 'counter') await possibleCopy(owner, c);
    throw e;
  }
  const fresh = await getPasskeys(owner); // re-read: keep a parallel change (another passkey added) intact
  await savePasskeys(owner, { ...(fresh ?? acc), creds: (fresh ?? acc).creds.map((x) => x.id === credId ? { ...x, counter: r.counter, synced: r.backedUp, last_used_at: new Date(now).toISOString() } : x) });
  return { email: owner, credId, name: c.name };
}

// B2 (review): a signature counter that did not grow can mean a copied passkey. The owner sees it in the activity list
// and gets a mail (at most one per passkey per hour); the sign-in itself is refused by the caller.
async function possibleCopy(email: string, c: PasskeyCred): Promise<void> {
  try {
    await logAudit({ actor: email, role: 'owner', action: 'passkey.cloned', email, detail: c.name });
    if (!(await rateLimited(`mail:pkcopy:${hex(await sha256(c.id))}`, 1, 3600))) await securityMail(email, 'passkey.cloned', { name: c.name });
  } catch { /* never changes the refusal */ }
}

// Which account a sign-in assertion names (before verifying), for the per-account rate limit. Never throws.
export async function ownerOfAssertion(cred: AssertionInput): Promise<string | null> {
  try { return await kvGet(await credKey(assertionCredentialId(cred))); } catch { return null; }
}

// ---- remove
export async function removePasskey(email: string, id: string): Promise<boolean> {
  const acc = await getPasskeys(email);
  if (!acc || !acc.creds.some((c) => c.id === id)) return false;
  const creds = acc.creds.filter((c) => c.id !== id);
  await savePasskeys(email, { ...acc, creds });
  await kvDel(await credKey(id));
  // The last second step gone: two-step sign-in is off, so the recovery codes go too.
  if (creds.length === 0) { const rec = await getMfa(email); if (rec && !rec.totp) await deleteMfa(email); }
  return true;
}

export async function deleteAllPasskeys(email: string): Promise<void> {
  const acc = await getPasskeys(email);
  for (const c of acc?.creds ?? []) await kvDel(await credKey(c.id));
  await kvDel(accKey(email));
}

// ---- fresh confirmation on the account page: a passkey of this account (confirm challenge bound to the session), or
// a code from the authenticator app / a recovery code. Shares the code limit (10 per 15 minutes per account).
export type Confirmed = { ok: true; via: 'passkey' | 'totp' | 'recovery' } | { ok: false; status: number; error: string; message: string };

export async function confirmFresh(email: string, sessionId: string, body: { credential?: unknown; code?: unknown } | null): Promise<Confirmed> {
  try {
    if (await codeAttemptsExceeded(email)) return { ok: false, status: 429, error: 'too_many', message: 'Too many tries. Wait 15 minutes and try again.' };
  } catch {
    return { ok: false, status: 503, error: 'unavailable', message: 'Not available right now. Try again in a minute.' };
  }
  if (body?.credential && typeof body.credential === 'object') {
    try {
      await finishAssertion('confirm', 'session:' + sessionId, body.credential as AssertionInput, email);
      return { ok: true, via: 'passkey' };
    } catch {
      return { ok: false, status: 401, error: 'invalid_passkey', message: 'That passkey did not work. Try again.' };
    }
  }
  const r = await redeemCode(email, body?.code);
  if (r.ok) return { ok: true, via: r.via! };
  return { ok: false, status: 401, error: 'invalid_code', message: 'That code did not work. Use the newest code from your app, or a recovery code.' };
}
