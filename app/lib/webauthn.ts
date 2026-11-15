// PASSKEYS-1: WebAuthn verification with WebCrypto only (edge runtime, no dependencies). See MFA-PASSKEYS-PLAN.md.
//   - a minimal CBOR decoder (unsigned/negative ints, byte/text strings, arrays, maps, true/false/null; definite lengths
//     only) for the attestation object and the COSE public key;
//   - registration: attestation format "none" only (no attestation chain is trusted or needed), clientData type,
//     challenge and origin, rpIdHash, flags UP + UV, credential id, COSE key ES256 (-7, required) or EdDSA (-8);
//   - assertion: the same clientData checks, rpIdHash, UP + UV, the signature over authData || SHA-256(clientDataJSON)
//     (ES256: the DER signature converted to raw r||s), and the sign counter must grow (or stay 0 when the
//     authenticator does not count, as synced passkeys do).
// Every failure throws WebAuthnError with a short code; nothing here touches storage. app/lib/passkeys.ts holds the
// records, challenges and policies.
import { b64u, unb64u } from '@/app/lib/keys';

export class WebAuthnError extends Error {
  constructor(public code: string) { super('webauthn: ' + code); }
}
const fail = (code: string): never => { throw new WebAuthnError(code); };

export const ALG_ES256 = -7;
export const ALG_EDDSA = -8;
export const ALLOWED_ALGS = [ALG_ES256, ALG_EDDSA];

const FLAG_UP = 0x01, FLAG_UV = 0x04, FLAG_BE = 0x08, FLAG_BS = 0x10, FLAG_AT = 0x40, FLAG_ED = 0x80;

// ---------------------------------------------------------------- CBOR (RFC 8949 subset)
export type Cbor = number | string | boolean | null | Uint8Array | Cbor[] | Map<number | string, Cbor>;

export function cborDecode(bytes: Uint8Array, start = 0): { value: Cbor; end: number } {
  let pos = start;
  const need = (n: number) => { if (pos + n > bytes.length) fail('cbor'); };
  const len = (info: number): number => {
    if (info < 24) return info;
    if (info === 24) { need(1); return bytes[pos++]; }
    if (info === 25) { need(2); const v = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2; return v; }
    if (info === 26) { need(4); const v = ((bytes[pos] << 24) >>> 0) + (bytes[pos + 1] << 16) + (bytes[pos + 2] << 8) + bytes[pos + 3]; pos += 4; return v; }
    if (info === 27) {
      need(8); let v = 0;
      for (let i = 0; i < 8; i++) v = v * 256 + bytes[pos + i];
      pos += 8; if (!Number.isSafeInteger(v)) fail('cbor'); return v;
    }
    return fail('cbor'); // 28-30 reserved, 31 indefinite length: not used by WebAuthn, refused
  };
  const item = (depth: number): Cbor => {
    if (depth > 16) fail('cbor');
    need(1);
    const b = bytes[pos++], major = b >> 5, info = b & 31;
    switch (major) {
      case 0: return len(info);
      case 1: return -1 - len(info);
      case 2: { const n = len(info); need(n); const v = bytes.slice(pos, pos + n); pos += n; return v; }
      case 3: { const n = len(info); need(n); const v = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(pos, pos + n)); pos += n; return v; }
      case 4: { const n = len(info); if (n > 1024) fail('cbor'); const a: Cbor[] = []; for (let i = 0; i < n; i++) a.push(item(depth + 1)); return a; }
      case 5: {
        const n = len(info); if (n > 256) fail('cbor');
        const m = new Map<number | string, Cbor>();
        for (let i = 0; i < n; i++) {
          const k = item(depth + 1);
          if (typeof k !== 'number' && typeof k !== 'string') fail('cbor');
          if (m.has(k as number | string)) fail('cbor'); // duplicate keys are invalid
          m.set(k as number | string, item(depth + 1));
        }
        return m;
      }
      case 7:
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        return fail('cbor'); // floats, undefined and other simple values never occur in what we parse
      default: return fail('cbor'); // tags (6) are not used
    }
  };
  const value = item(0);
  return { value, end: pos };
}

// ---------------------------------------------------------------- helpers
const enc = new TextEncoder();
export async function sha256(data: Uint8Array | string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', (typeof data === 'string' ? enc.encode(data) : data) as BufferSource));
}
function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
function bytesOf(s: unknown, code: string): Uint8Array {
  if (typeof s !== 'string' || s.length === 0 || s.length > 16384 || !/^[A-Za-z0-9_-]+={0,2}$/.test(s)) return fail(code);
  try { return unb64u(s.replace(/=+$/, '')); } catch { return fail(code); }
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const uuid = (b: Uint8Array) => { const h = hex(b); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };

export type RelyingParty = { id: string; origin: string };

type ClientData = { type: string; challenge: string; origin: string; crossOrigin?: boolean };
// The clientDataJSON the browser signed: its challenge is how the server finds the challenge record.
export function readClientData(clientDataJSON: unknown): { raw: Uint8Array; data: ClientData } {
  const raw = bytesOf(clientDataJSON, 'client_data');
  let data: ClientData;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { return fail('client_data'); }
  if (!data || typeof data !== 'object' || typeof data.type !== 'string' || typeof data.challenge !== 'string' || typeof data.origin !== 'string') fail('client_data');
  return { raw, data };
}
function checkClientData(data: ClientData, type: 'webauthn.create' | 'webauthn.get', challenge: string, rp: RelyingParty) {
  if (data.type !== type) fail('type');
  if (!challenge || data.challenge !== challenge) fail('challenge');
  if (data.origin !== rp.origin) fail('origin');
  if (data.crossOrigin === true) fail('origin'); // never inside another site's iframe
}

export type AuthData = {
  rpIdHash: Uint8Array; flags: number; counter: number;
  aaguid?: string; credentialId?: Uint8Array; coseKey?: Map<number | string, Cbor>;
};
export function parseAuthData(a: Uint8Array): AuthData {
  if (a.length < 37) fail('auth_data');
  const flags = a[32];
  const counter = ((a[33] << 24) >>> 0) + (a[34] << 16) + (a[35] << 8) + a[36];
  const out: AuthData = { rpIdHash: a.slice(0, 32), flags, counter };
  let pos = 37;
  if (flags & FLAG_AT) {
    if (a.length < pos + 18) fail('auth_data');
    out.aaguid = uuid(a.subarray(pos, pos + 16)); pos += 16;
    const n = (a[pos] << 8) | a[pos + 1]; pos += 2;
    if (n < 16 || n > 1023 || a.length < pos + n) fail('cred_id');
    out.credentialId = a.slice(pos, pos + n); pos += n;
    const k = cborDecode(a, pos);
    if (!(k.value instanceof Map)) fail('cose');
    out.coseKey = k.value as Map<number | string, Cbor>; pos = k.end;
  }
  if (flags & FLAG_ED) pos = cborDecode(a, pos).end; // extensions: read past, not used
  if (pos !== a.length) fail('auth_data'); // no trailing bytes
  return out;
}

async function checkRp(auth: AuthData, rp: RelyingParty) {
  if (!eq(auth.rpIdHash, await sha256(rp.id))) fail('rp_id');
  if (!(auth.flags & FLAG_UP)) fail('user_presence');
  if (!(auth.flags & FLAG_UV)) fail('user_verification');
}

// ---------------------------------------------------------------- COSE → JWK
export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string } | { kty: 'OKP'; crv: 'Ed25519'; x: string };

export function coseToJwk(k: Map<number | string, Cbor>, allowed: number[] = ALLOWED_ALGS): { alg: number; jwk: PublicJwk } {
  const kty = k.get(1), alg = k.get(3), crv = k.get(-1), x = k.get(-2), y = k.get(-3);
  if (typeof alg !== 'number' || !allowed.includes(alg)) fail('alg');
  if (alg === ALG_ES256) {
    if (kty !== 2 || crv !== 1 || !(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) fail('cose');
    return { alg, jwk: { kty: 'EC', crv: 'P-256', x: b64u(x as Uint8Array), y: b64u(y as Uint8Array) } };
  }
  if (kty !== 1 || crv !== 6 || !(x instanceof Uint8Array) || x.length !== 32) fail('cose');
  return { alg: ALG_EDDSA, jwk: { kty: 'OKP', crv: 'Ed25519', x: b64u(x as Uint8Array) } };
}

async function importKey(alg: number, jwk: PublicJwk): Promise<CryptoKey> {
  try {
    if (alg === ALG_ES256) return await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    if (alg === ALG_EDDSA) return await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'Ed25519' }, false, ['verify']);
  } catch { /* below */ }
  return fail('cose');
}

// ASN.1 DER ECDSA signature (SEQUENCE { INTEGER r, INTEGER s }) → raw 64 bytes r||s, strictly parsed.
export function derToRaw(der: Uint8Array): Uint8Array {
  let p = 0;
  const byte = () => { if (p >= der.length) fail('signature'); return der[p++]; };
  if (byte() !== 0x30) fail('signature');
  const total = byte();
  if (total & 0x80 || p + total !== der.length) fail('signature');
  const int = (): Uint8Array => {
    if (byte() !== 0x02) fail('signature');
    const n = byte();
    if (n < 1 || n > 33 || p + n > der.length) fail('signature');
    let v = der.subarray(p, p + n); p += n;
    while (v.length > 1 && v[0] === 0) v = v.subarray(1);
    if (v.length > 32) fail('signature');
    const out = new Uint8Array(32); out.set(v, 32 - v.length); return out;
  };
  const r = int(), s = int();
  if (p !== der.length) fail('signature');
  const raw = new Uint8Array(64); raw.set(r, 0); raw.set(s, 32); return raw;
}

// ---------------------------------------------------------------- ceremonies
export type RegistrationInput = { id?: unknown; rawId?: unknown; response?: { clientDataJSON?: unknown; attestationObject?: unknown } };
export type Registered = { credentialId: string; jwk: PublicJwk; alg: number; counter: number; aaguid: string; backupEligible: boolean; backedUp: boolean };

export async function verifyRegistration(cred: RegistrationInput, challenge: string, rp: RelyingParty, allowed = ALLOWED_ALGS): Promise<Registered> {
  const { data } = readClientData(cred?.response?.clientDataJSON);
  checkClientData(data, 'webauthn.create', challenge, rp);
  const att = cborDecode(bytesOf(cred?.response?.attestationObject, 'attestation'));
  const m = att.value;
  if (!(m instanceof Map)) return fail('attestation');
  if (m.get('fmt') !== 'none') fail('attestation');
  const stmt = m.get('attStmt');
  if (!(stmt instanceof Map) || stmt.size !== 0) fail('attestation');
  const authBytes = m.get('authData');
  if (!(authBytes instanceof Uint8Array)) return fail('attestation');
  const auth = parseAuthData(authBytes);
  await checkRp(auth, rp);
  if (!auth.credentialId || !auth.coseKey) return fail('cred_id');
  const credentialId = b64u(auth.credentialId);
  const claimed = typeof cred.rawId === 'string' ? cred.rawId : cred.id;
  if (typeof claimed !== 'string' || !eq(bytesOf(claimed, 'cred_id'), auth.credentialId)) fail('cred_id');
  const { alg, jwk } = coseToJwk(auth.coseKey, allowed);
  await importKey(alg, jwk); // the key must actually be usable (a point on the curve)
  return { credentialId, jwk, alg, counter: auth.counter, aaguid: auth.aaguid ?? '', backupEligible: !!(auth.flags & FLAG_BE), backedUp: !!(auth.flags & FLAG_BS) };
}

export type AssertionInput = { id?: unknown; rawId?: unknown; response?: { clientDataJSON?: unknown; authenticatorData?: unknown; signature?: unknown; userHandle?: unknown } };

// The credential id the browser says it used (looked up before verifying).
export function assertionCredentialId(cred: AssertionInput): string {
  const claimed = typeof cred?.rawId === 'string' ? cred.rawId : cred?.id;
  return b64u(bytesOf(claimed, 'cred_id'));
}
export function assertionUserHandle(cred: AssertionInput): string | null {
  const h = cred?.response?.userHandle;
  if (h === null || h === undefined || h === '') return null;
  return b64u(bytesOf(h, 'user_handle'));
}

export async function verifyAssertion(
  cred: AssertionInput, challenge: string, rp: RelyingParty,
  stored: { alg: number; jwk: PublicJwk; counter: number }, allowed = ALLOWED_ALGS,
): Promise<{ counter: number; backedUp: boolean }> {
  const { raw, data } = readClientData(cred?.response?.clientDataJSON);
  checkClientData(data, 'webauthn.get', challenge, rp);
  const authBytes = bytesOf(cred?.response?.authenticatorData, 'auth_data');
  const auth = parseAuthData(authBytes);
  await checkRp(auth, rp);
  if (!allowed.includes(stored.alg)) fail('alg');
  const sig = bytesOf(cred?.response?.signature, 'signature');
  const key = await importKey(stored.alg, stored.jwk);
  const signed = new Uint8Array(authBytes.length + 32);
  signed.set(authBytes, 0); signed.set(await sha256(raw), authBytes.length);
  const ok = stored.alg === ALG_ES256
    ? await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sig) as BufferSource, signed as BufferSource)
    : await crypto.subtle.verify({ name: 'Ed25519' }, key, sig as BufferSource, signed as BufferSource);
  if (!ok) fail('signature');
  // A counter that does not grow means a cloned authenticator; 0 → 0 is an authenticator that does not count.
  if (!(auth.counter === 0 && stored.counter === 0) && auth.counter <= stored.counter) fail('counter');
  return { counter: auth.counter, backedUp: !!(auth.flags & FLAG_BS) };
}

export function newChallenge(): string {
  const b = new Uint8Array(32); crypto.getRandomValues(b); return b64u(b);
}
