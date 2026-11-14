export const runtime = 'edge';

// Sessions live in KV (session:<id>). LOGIN-1: the cookie value is also signed, so a session that was written a
// moment ago is not lost when a KV read right after the write does not see it yet (KV is eventually consistent; the
// account page reads it within a second of the sign-in).
//
// Cookie value:  s1.<id>.<issued-at ms>.<base64url email>.<HMAC-SHA256 over everything before it>
// Rules:  a bad signature is refused outright. KV has the record → KV decides (expiry, email must match).
//         KV has nothing → trusted only while the cookie is younger than FRESH_MS (it was just issued by us).
// The HMAC key is SESSION_SECRET, or else derived (HKDF, own label) from LEASE_PRIVATE_KEY, so no new secret is needed.
// Without either, cookies are the bare id (as before) and only KV counts. Old bare-id cookies keep working.
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';

const DAY_MS = 86_400_000;
export const FRESH_MS = 120_000;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ''; for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

let keyCache: { src: string; key: CryptoKey } | null = null;
async function hmacKey(): Promise<CryptoKey | null> {
  const src = process.env.SESSION_SECRET || process.env.LEASE_PRIVATE_KEY || '';
  if (!src) return null;
  if (keyCache?.src === src) return keyCache.key;
  const ikm = await crypto.subtle.importKey('raw', enc.encode(src.trim()), 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('powerguardian'), info: enc.encode('pg_session cookie v1') },
    ikm, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify'],
  );
  keyCache = { src, key };
  return key;
}

type Parsed = { id: string; iat: number; email: string } | { id: string; iat: null; email: null };

async function parseCookie(value: string): Promise<Parsed | null> {
  if (!value) return null;
  if (/^[0-9a-f]{64}$/.test(value)) return { id: value, iat: null, email: null }; // bare id (old cookies / no key)
  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== 's1' || !/^[0-9a-f]{64}$/.test(parts[1]) || !/^\d{1,15}$/.test(parts[2])) return null;
  const key = await hmacKey();
  if (!key) return null;
  let sig: Uint8Array, email: string;
  try { sig = unb64u(parts[4]); email = new TextDecoder().decode(unb64u(parts[3])); } catch { return null; }
  const ok = await crypto.subtle.verify('HMAC', key, sig as BufferSource, enc.encode(parts.slice(0, 4).join('.')));
  return ok ? { id: parts[1], iat: Number(parts[2]), email } : null;
}

// Returns the cookie value to set.
export async function createSession(email: string, now = Date.now()): Promise<string> {
  const id = randomHex(32);
  await kvPut(`session:${id}`, JSON.stringify({ email, expires: now + DAY_MS }));
  const key = await hmacKey();
  if (!key) return id;
  const head = `s1.${id}.${now}.${b64u(enc.encode(email))}`;
  return `${head}.${b64u(await crypto.subtle.sign('HMAC', key, enc.encode(head)))}`;
}

export async function getSession(cookie: string, now = Date.now()): Promise<string | null> {
  const p = await parseCookie(cookie);
  if (!p) return null;
  const raw = await kvGet(`session:${p.id}`);
  if (!raw) {
    // KV lag right after the sign-in: trust our own fresh signature, nothing older.
    if (p.iat !== null && now >= p.iat && now - p.iat < FRESH_MS) return p.email;
    return null;
  }
  try {
    const { email, expires } = JSON.parse(raw);
    if (expires < now) return null;
    if (p.email !== null && String(email).toLowerCase() !== p.email.toLowerCase()) return null;
    return email;
  } catch {
    return null;
  }
}

export async function deleteSession(cookie: string): Promise<void> {
  const p = await parseCookie(cookie);
  if (p) await kvDel(`session:${p.id}`);
}
