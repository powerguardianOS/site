export const runtime = 'edge';

// Sessions. LOGIN-1: the cookie value is also signed, so a session that was written a moment ago is not lost when a KV
// read right after the write does not see it yet (KV is eventually consistent; the account page reads it within a second
// of the sign-in).
//
// Cookie value:  s2.<id>.<issued-at ms>.<base64url email>.<flags>.<HMAC-SHA256 over everything before it>
//   flags: "m" = this session passed two-step sign-in (CLOUD-MFA), "-" = it did not.
//   (s1 = the same without flags, from LOGIN-1; still read, as "no two-step".)
//
// SESSIONS-1: the id is a secret, so storage never holds it. Record: session:h:<sha256(id)> = { email, expires, mfa,
// created, seen, method, via, ua, ip, country, city } (KV TTL = the session's life). Per account: sessions:<email> = the
// hashes of its live sessions (index; "Sign-in & security" on the account page lists and signs out by it).
// Signing out a session (owner, or the cookie's own Sign out) overwrites its record with a tombstone { revoked } for
// the rest of its life and drops it from the index. A tombstone wins over everything, including the fresh-cookie grace.
// Old records (session:<id>, before SESSIONS-1) are still read; the first read copies one into the new form + index.
// Rules:  a bad signature is refused outright. A record (new or old form) decides (tombstone, expiry, email, mfa).
//         No record at all → trusted only while the cookie is younger than FRESH_MS (it was just issued by us).
// "Last seen" is written at most once per TOUCH_MS per session.
// The HMAC key comes from app/lib/keys (SESSION_SECRET, or HKDF of LEASE_PRIVATE_KEY). Without either, cookies are the
// bare id (as before) and only KV counts. Old bare-id cookies keep working.
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { hmacKey, b64u, unb64u } from '@/app/lib/keys';
import type { ClientInfo } from '@/app/lib/client-info';

const DAY_MS = 86_400_000;
export const FRESH_MS = 120_000;
export const TOUCH_MS = 5 * 60_000;
export const MAX_SESSIONS = 20;
const KEY_INFO = 'pg_session cookie v1';

export type SignInMethod = 'link' | 'code' | 'passkey'; // B2: passkey = passwordless (PASSKEYS-1)
export type SecondStep = 'totp' | 'recovery' | 'passkey';
export type SessionRecord = {
  email: string; expires: number; mfa?: boolean;
  created?: number; seen?: number; method?: SignInMethod; via?: SecondStep;
  ua?: string; ip?: string; country?: string; city?: string;
  revoked?: boolean;
};
type IndexEntry = { h: string; exp: number };

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
export const hashId = async (id: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(id)));
const recKey = (h: string) => `session:h:${h}`;
const legacyKey = (id: string) => `session:${id}`;
const indexKey = (email: string) => `sessions:${email.toLowerCase()}`;
const ttlS = (exp: number, now: number) => Math.max(60, Math.ceil((exp - now) / 1000));

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

// ---- per-account index (hashes only)

async function readIndex(email: string, now: number): Promise<IndexEntry[]> {
  const raw = await kvGet(indexKey(email));
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as IndexEntry[];
    return Array.isArray(list) ? list.filter((e) => e && /^[0-9a-f]{64}$/.test(e.h) && e.exp > now) : [];
  } catch { return []; }
}
async function writeIndex(email: string, list: IndexEntry[], now: number): Promise<void> {
  if (!list.length) { await kvDel(indexKey(email)); return; }
  await kvPut(indexKey(email), JSON.stringify(list), ttlS(Math.max(...list.map((e) => e.exp)), now));
}
async function addToIndex(email: string, entry: IndexEntry, now: number): Promise<void> {
  const list = (await readIndex(email, now)).filter((e) => e.h !== entry.h);
  list.push(entry);
  // More than MAX_SESSIONS at once: the oldest are signed out (an index entry is the only way to sign one out).
  list.sort((a, b) => a.exp - b.exp);
  while (list.length > MAX_SESSIONS) {
    const old = list.shift()!;
    await tombstone(old.h, email, now, old.exp);
  }
  await writeIndex(email, list, now);
}

async function tombstone(h: string, email: string, now: number, exp = now + DAY_MS): Promise<void> {
  await kvPut(recKey(h), JSON.stringify({ email: email.toLowerCase(), expires: exp, revoked: true }), ttlS(exp, now));
}

// ---- create / read

export type CreateOpts = { mfa?: boolean; now?: number; method?: SignInMethod; via?: SecondStep; client?: ClientInfo };

// Returns the cookie value to set. mfa: this sign-in passed the two-step check.
export async function createSession(email: string, opts: CreateOpts = {}): Promise<string> {
  const now = opts.now ?? Date.now();
  const id = randomHex(32);
  const h = await hashId(id);
  const exp = now + DAY_MS;
  const c = opts.client;
  const rec: SessionRecord = {
    email, expires: exp, ...(opts.mfa ? { mfa: true } : {}), created: now, seen: now,
    ...(opts.method ? { method: opts.method } : {}), ...(opts.via ? { via: opts.via } : {}),
    ...(c ? { ua: c.ua, ip: c.ip, country: c.country, city: c.city } : {}),
  };
  await kvPut(recKey(h), JSON.stringify(rec), ttlS(exp, now));
  await addToIndex(email, { h, exp }, now); // fails closed: a session the owner cannot see is a session they cannot end
  const key = await hmacKey(KEY_INFO);
  if (!key) return id;
  const head = `s2.${id}.${now}.${b64u(enc.encode(email))}.${opts.mfa ? 'm' : '-'}`;
  return `${head}.${b64u(await crypto.subtle.sign('HMAC', key, enc.encode(head)))}`;
}

export type SessionInfo = { email: string; mfa: boolean; h?: string };

const parseRec = (raw: string): SessionRecord | null => { try { return JSON.parse(raw) as SessionRecord; } catch { return null; } };

// client: the request's ClientInfo, when the caller has it — "last seen" then also notes where from.
export async function getSessionInfo(cookie: string, now = Date.now(), client?: ClientInfo): Promise<SessionInfo | null> {
  const p = await parseCookie(cookie);
  if (!p) return null;
  const h = await hashId(p.id);
  const raw = await kvGet(recKey(h));
  if (raw) {
    const rec = parseRec(raw);
    if (!rec || rec.revoked || !(rec.expires > now)) return null;
    if (p.email !== null && String(rec.email).toLowerCase() !== p.email.toLowerCase()) return null;
    if (!(now - (rec.seen ?? 0) < TOUCH_MS)) await touch(h, rec, now, client);
    return { email: rec.email, mfa: rec.mfa === true, h };
  }
  const old = await kvGet(legacyKey(p.id));
  if (old) {
    const rec = parseRec(old);
    if (!rec || !(rec.expires > now)) return null;
    if (p.email !== null && String(rec.email).toLowerCase() !== p.email.toLowerCase()) return null;
    // copy into the new form + index (once; the old record stays until its Sign out, so a lagging read still finds it)
    try {
      await kvPut(recKey(h), JSON.stringify({ ...rec, seen: now, ...(client ? { ua: client.ua, ip: client.ip, country: client.country, city: client.city } : {}) }), ttlS(rec.expires, now));
      await addToIndex(rec.email, { h, exp: rec.expires }, now);
    } catch { /* still a valid session */ }
    return { email: rec.email, mfa: rec.mfa === true, h };
  }
  // KV lag right after the sign-in: trust our own fresh signature, nothing older. (A signed-out session is never here:
  // its tombstone is a record.)
  if (p.iat !== null && p.email !== null && now >= p.iat && now - p.iat < FRESH_MS) return { email: p.email, mfa: p.mfa, h };
  return null;
}

// At most once per TOUCH_MS: last seen (+ where from), and back into the index if a racing write lost it there.
async function touch(h: string, rec: SessionRecord, now: number, client?: ClientInfo): Promise<void> {
  try {
    const next: SessionRecord = { ...rec, seen: now, ...(client?.ip ? { ip: client.ip, country: client.country, city: client.city } : {}) };
    await kvPut(recKey(h), JSON.stringify(next), ttlS(rec.expires, now));
    const list = await readIndex(rec.email, now);
    if (!list.some((e) => e.h === h)) await addToIndex(rec.email, { h, exp: rec.expires }, now);
  } catch { /* "last seen" never fails a request */ }
}

export async function getSession(cookie: string, now = Date.now(), client?: ClientInfo): Promise<string | null> {
  return (await getSessionInfo(cookie, now, client))?.email ?? null;
}

// The signed-in owner just proved the authenticator (set it up from the account page): this session counts as
// two-step from now on.
export async function markSessionMfa(cookie: string): Promise<void> {
  const p = await parseCookie(cookie);
  if (!p) return;
  const h = await hashId(p.id);
  for (const k of [recKey(h), legacyKey(p.id)]) {
    const raw = await kvGet(k);
    const rec = raw ? parseRec(raw) : null;
    if (!rec || rec.revoked) continue;
    await kvPut(k, JSON.stringify({ ...rec, mfa: true }), k === recKey(h) ? ttlS(rec.expires, Date.now()) : undefined);
  }
}

// Sign out of this browser (the cookie's own session).
export async function deleteSession(cookie: string, now = Date.now()): Promise<void> {
  const p = await parseCookie(cookie);
  if (!p) return;
  const h = await hashId(p.id);
  const raw = await kvGet(recKey(h)) ?? await kvGet(legacyKey(p.id));
  const rec = raw ? parseRec(raw) : null;
  const email = rec?.email ?? p.email;
  if (email) await tombstone(h, email, now, rec?.expires && rec.expires > now ? rec.expires : (p.iat ?? now) + DAY_MS);
  await kvDel(legacyKey(p.id));
  if (email) {
    const list = await readIndex(email, now);
    if (list.some((e) => e.h === h)) await writeIndex(email, list.filter((e) => e.h !== h), now);
  }
}

// ---- the owner's list (SESSIONS-1)

export const refOf = (h: string) => h.slice(0, 16); // what the page sees and sends back; never the id itself
export type OwnSession = SessionRecord & { h: string };

export async function countSessions(email: string, now = Date.now()): Promise<number> {
  return (await readIndex(email, now)).length;
}

export async function listSessions(email: string, now = Date.now()): Promise<OwnSession[]> {
  const list = await readIndex(email, now);
  const rows = await Promise.all(list.map(async (e) => {
    const raw = await kvGet(recKey(e.h)).catch(() => null);
    const rec = raw ? parseRec(raw) : null;
    if (!rec || rec.revoked || !(rec.expires > now) || rec.email.toLowerCase() !== email.toLowerCase()) return null;
    return { ...rec, h: e.h };
  }));
  return rows.filter((r): r is OwnSession => !!r).sort((a, b) => (b.seen ?? 0) - (a.seen ?? 0));
}

// Signs out one of the account's own sessions by its ref. Only a ref in this account's own index counts; the record
// must name this account too. Returns the record that was ended (for the activity line), or null.
export async function revokeSession(email: string, ref: string, now = Date.now()): Promise<OwnSession | null> {
  if (!/^[0-9a-f]{16}$/.test(ref)) return null;
  const list = await readIndex(email, now);
  const hit = list.find((e) => refOf(e.h) === ref);
  if (!hit) return null;
  const raw = await kvGet(recKey(hit.h));
  const rec = raw ? parseRec(raw) : null;
  if (rec && rec.email.toLowerCase() !== email.toLowerCase()) return null;
  await tombstone(hit.h, email, now, hit.exp);
  await writeIndex(email, list.filter((e) => e.h !== hit.h), now);
  return rec ? { ...rec, h: hit.h } : { email, expires: hit.exp, h: hit.h };
}

// B2: the account is deleted — every session of it ends at once (tombstones) and the index goes.
export async function revokeAllSessions(email: string, now = Date.now()): Promise<number> {
  const list = await readIndex(email, now);
  for (const e of list) await tombstone(e.h, email, now, e.exp);
  await kvDel(indexKey(email));
  return list.length;
}

// Signs out every session of the account except keepH (the caller's own). Returns how many.
export async function revokeOtherSessions(email: string, keepH: string, now = Date.now()): Promise<number> {
  const list = await readIndex(email, now);
  const others = list.filter((e) => e.h !== keepH);
  for (const e of others) await tombstone(e.h, email, now, e.exp);
  await writeIndex(email, list.filter((e) => e.h === keepH), now);
  return others.length;
}
