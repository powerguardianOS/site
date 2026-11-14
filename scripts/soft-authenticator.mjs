// PASSKEYS-1 test helper: a software WebAuthn authenticator (WebCrypto, no dependencies) that answers the same JSON the
// browser code posts (app/lib/webauthn-client.ts). Used by the unit tests (tests/passkeys.test.mts), the fixed vectors
// (tests/fixtures/webauthn-vectors.json) and scripts/isolation-e2e.mjs. Test code only; never shipped.
//   const a = new SoftAuthenticator({ origin: 'https://powerguardian.cloud' });
//   const reg = await a.create(publicKeyJson);        // → { id, rawId, type, response: { clientDataJSON, attestationObject } }
//   const asr = await a.get(publicKeyJson);           // → { id, rawId, type, response: { clientDataJSON, authenticatorData, signature, userHandle } }
// Overrides (second argument) produce the broken answers the security tests need: origin, rpId, type, challenge,
// uv:false, up:false, counter, fmt, crossOrigin, credId, alg (the COSE alg written into the key).
import { webcrypto as crypto } from 'node:crypto';

const enc = new TextEncoder();
export const b64u = (b) => Buffer.from(b).toString('base64url');
export const unb64u = (s) => new Uint8Array(Buffer.from(s, 'base64url'));
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof b === 'string' ? enc.encode(b) : b));
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { out.set(x, p); p += x.length; } return out; };

// ---- CBOR encoder (the subset WebAuthn uses)
function head(major, n) {
  if (n < 24) return Uint8Array.of((major << 5) | n);
  if (n < 256) return Uint8Array.of((major << 5) | 24, n);
  if (n < 65536) return Uint8Array.of((major << 5) | 25, n >> 8, n & 255);
  return Uint8Array.of((major << 5) | 26, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
}
export function cbor(v) {
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') { const b = enc.encode(v); return cat(head(3, b.length), b); }
  if (v instanceof Uint8Array) return cat(head(2, v.length), v);
  if (Array.isArray(v)) return cat(head(4, v.length), ...v.map(cbor));
  if (v instanceof Map) return cat(head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)]));
  if (v === true) return Uint8Array.of(0xf5);
  if (v === false) return Uint8Array.of(0xf4);
  if (v === null) return Uint8Array.of(0xf6);
  throw new Error('cbor: unsupported');
}

// raw r||s (WebCrypto ECDSA) → DER, as authenticators send it
function rawToDer(raw) {
  const int = (b) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.slice(i); if (b[0] & 0x80) b = cat(Uint8Array.of(0), b); return cat(Uint8Array.of(2, b.length), b); };
  const body = cat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return cat(Uint8Array.of(0x30, body.length), body);
}

export class SoftAuthenticator {
  constructor({ origin, rpId, alg = -7, aaguid = new Uint8Array(16), counting = true, backup = false } = {}) {
    this.origin = origin; this.rpId = rpId ?? new URL(origin).hostname; this.alg = alg; this.aaguid = aaguid;
    this.counting = counting; this.backup = backup; this.creds = new Map();
  }

  async authData({ rpId, up = true, uv = true, counter, attested }) {
    const flags = (up ? 0x01 : 0) | (uv ? 0x04 : 0) | (this.backup ? 0x18 : 0) | (attested ? 0x40 : 0);
    const c = Uint8Array.of((counter >>> 24) & 255, (counter >> 16) & 255, (counter >> 8) & 255, counter & 255);
    return cat(await sha256(rpId), Uint8Array.of(flags), c, attested ?? new Uint8Array(0));
  }

  clientData(type, challenge, o) {
    return enc.encode(JSON.stringify({ type: o.type ?? type, challenge: o.challenge ?? challenge, origin: o.origin ?? this.origin, ...(o.crossOrigin !== undefined ? { crossOrigin: o.crossOrigin } : {}) }));
  }

  async create(pk, o = {}) {
    const alg = this.alg;
    const kp = alg === -8
      ? await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
      : await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    const coseAlg = o.alg ?? alg;
    const cose = alg === -8
      ? new Map([[1, 1], [3, coseAlg], [-1, 6], [-2, unb64u(jwk.x)]])
      : new Map([[1, 2], [3, coseAlg], [-1, 1], [-2, unb64u(jwk.x)], [-3, unb64u(jwk.y)]]);
    const credId = o.credId ?? crypto.getRandomValues(new Uint8Array(32));
    const attested = cat(this.aaguid, Uint8Array.of(credId.length >> 8, credId.length & 255), credId, cbor(cose));
    const counter = o.counter ?? 0;
    const auth = await this.authData({ rpId: o.rpId ?? this.rpId, up: o.up, uv: o.uv, counter, attested });
    const att = cbor(new Map([['fmt', o.fmt ?? 'none'], ['attStmt', new Map()], ['authData', auth]]));
    const id = b64u(credId);
    this.creds.set(id, { key: kp.privateKey, alg, counter, userHandle: pk.user?.id ?? null });
    return { id, rawId: id, type: 'public-key', response: { clientDataJSON: b64u(this.clientData('webauthn.create', pk.challenge, o)), attestationObject: b64u(att) } };
  }

  // The credential to use: o.credId, else the first one allowed (or the only one this authenticator holds).
  async get(pk, o = {}) {
    const allowed = (pk.allowCredentials ?? []).map((c) => c.id);
    const id = o.useId ?? allowed.find((x) => this.creds.has(x)) ?? [...this.creds.keys()][0];
    const c = this.creds.get(id);
    if (!c) throw new Error('soft authenticator: no credential');
    if (this.counting && o.counter === undefined) c.counter += 1;
    const counter = o.counter ?? c.counter;
    const auth = await this.authData({ rpId: o.rpId ?? this.rpId, up: o.up, uv: o.uv, counter });
    const cd = this.clientData('webauthn.get', pk.challenge, o);
    const msg = cat(auth, await sha256(cd));
    const sig = c.alg === -8
      ? new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, c.key, msg))
      : rawToDer(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, c.key, msg)));
    return { id: o.claimId ?? id, rawId: o.claimId ?? id, type: 'public-key', response: {
      clientDataJSON: b64u(cd), authenticatorData: b64u(auth), signature: b64u(sig), userHandle: o.userHandle !== undefined ? o.userHandle : c.userHandle } };
  }
}
