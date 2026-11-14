export const runtime = 'edge';

// Sessions live in KV (session:<id>). LOGIN-1: the cookie value is also signed, so a session that was written a
// moment ago is not lost when a KV read right after the write does not see it yet (KV is eventually consistent; the
// account page reads it within a second of the sign-in).
//
// Cookie value:  s2.<id>.<issued-at ms>.<base64url email>.<flags>.<HMAC-SHA256 over everything before it>
//   flags: "m" = this session passed two-step sign-in (CLOUD-MFA), "-" = it did not.
//   (s1 = the same without flags, from LOGIN-1; still read, as "no two-step".)
// Rules:  a bad signature is refused outright. KV has the record → KV decides (expiry, email must match, mfa).
//         KV has nothing → trusted only while the cookie is younger than FRESH_MS (it was just issued by us).
// The HMAC key comes from app/lib/keys (SESSION_SECRET, or HKDF of LEASE_PRIVATE_KEY). Without either, cookies are the
// bare id (as before) and only KV counts. Old bare-id cookies keep working.
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { hmacKey, b64u, unb64u } from '@/app/lib/keys';

const DAY_MS = 86_400_000;
export const FRESH_MS = 120_000;
const KEY_INFO = 'pg_session cookie v1';

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

const enc = new TextEncoder();
type Parsed = { id: string; iat: number | null; email: string | null; mfa: boolean };

async function parseCookie(value: string): Promise<Parsed | null> {
  if (!value) return null;
  if (/^[0-9a-f]{64}$/.test(value)) return { id: value, iat: null, email: null, mfa: false }; // bare id
  const parts = value.split('.');
  const v2 = parts[0] === 's2' && parts.length === 6 && (parts[4] === 'm' || parts[4] === '-');
  const v1 = parts[0] === 's1' && parts.length === 5;
  if ((!v1 && !v2) || !/^[0-9a-f]{64}$/.test(parts[1]) || !/^\d{1,15}$/.test(parts[2])) return null;
  const key = await hmacKey(KEY_INFO);
  if (!key) return null;
  let sig: Uint8Array, email: string;
  try { sig = unb64u(parts[parts.length - 1]); email = new TextDecoder().decode(unb64u(parts[3])); } catch { return null; }
  const ok = await crypto.subtle.verify('HMAC', key, sig as BufferSource, enc.encode(parts.slice(0, -1).join('.')));
  return ok ? { id: parts[1], iat: Number(parts[2]), email, mfa: v2 && parts[4] === 'm' } : null;
}

// Returns the cookie value to set. mfa: this sign-in passed the two-step check.
export async function createSession(email: string, opts: { mfa?: boolean; now?: number } = {}): Promise<string> {
  const now = opts.now ?? Date.now();
  const id = randomHex(32);
  await kvPut(`session:${id}`, JSON.stringify({ email, expires: now + DAY_MS, ...(opts.mfa ? { mfa: true } : {}) }));
  const key = await hmacKey(KEY_INFO);
  if (!key) return id;
  const head = `s2.${id}.${now}.${b64u(enc.encode(email))}.${opts.mfa ? 'm' : '-'}`;
  return `${head}.${b64u(await crypto.subtle.sign('HMAC', key, enc.encode(head)))}`;
}

export type SessionInfo = { email: string; mfa: boolean };

export async function getSessionInfo(cookie: string, now = Date.now()): Promise<SessionInfo | null> {
  const p = await parseCookie(cookie);
  if (!p) return null;
  const raw = await kvGet(`session:${p.id}`);
  if (!raw) {
    // KV lag right after the sign-in: trust our own fresh signature, nothing older.
    if (p.iat !== null && p.email !== null && now >= p.iat && now - p.iat < FRESH_MS) return { email: p.email, mfa: p.mfa };
    return null;
  }
  try {
    const rec = JSON.parse(raw) as { email: string; expires: number; mfa?: boolean };
    if (rec.expires < now) return null;
    if (p.email !== null && String(rec.email).toLowerCase() !== p.email.toLowerCase()) return null;
    return { email: rec.email, mfa: rec.mfa === true };
  } catch {
    return null;
  }
}

export async function getSession(cookie: string, now = Date.now()): Promise<string | null> {
  return (await getSessionInfo(cookie, now))?.email ?? null;
}

// The signed-in owner just proved the authenticator (set it up from the account page): this session counts as
// two-step from now on.
export async function markSessionMfa(cookie: string): Promise<void> {
  const p = await parseCookie(cookie);
  if (!p) return;
  const raw = await kvGet(`session:${p.id}`);
  if (!raw) return;
  const rec = JSON.parse(raw);
  await kvPut(`session:${p.id}`, JSON.stringify({ ...rec, mfa: true }));
}

export async function deleteSession(cookie: string): Promise<void> {
  const p = await parseCookie(cookie);
  if (p) await kvDel(`session:${p.id}`);
}
