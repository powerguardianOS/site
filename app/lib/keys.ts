// Keys derived for one purpose each (HKDF, own label per use) from SESSION_SECRET, or else from LEASE_PRIVATE_KEY, so
// no new secret has to be configured. Returns null when neither is set (callers then fall back or fail closed).
const enc = new TextEncoder();

export const b64u = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ''; for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

const cache = new Map<string, { src: string; key: CryptoKey }>();

async function derive(info: string, alg: HmacKeyGenParams | AesKeyGenParams, usages: KeyUsage[]): Promise<CryptoKey | null> {
  const src = process.env.SESSION_SECRET || process.env.LEASE_PRIVATE_KEY || '';
  if (!src) return null;
  const hit = cache.get(info);
  if (hit?.src === src) return hit.key;
  const ikm = await crypto.subtle.importKey('raw', enc.encode(src.trim()), 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('powerguardian'), info: enc.encode(info) }, ikm, alg, false, usages);
  cache.set(info, { src, key });
  return key;
}

export const hmacKey = (info: string) => derive(info, { name: 'HMAC', hash: 'SHA-256', length: 256 }, ['sign', 'verify']);
export const aesKey = (info: string) => derive(info, { name: 'AES-GCM', length: 256 }, ['encrypt', 'decrypt']);
