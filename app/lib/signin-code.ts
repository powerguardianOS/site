export const runtime = 'edge';

// LOGIN-2: one pending sign-in per request, bound to the browser that asked. Every request mails a link AND a 6-digit
// code. An HttpOnly cookie (pg_login_req, Path=/api/auth) holds a random nonce; KV keeps only hashes:
//   signin:req:<sha256(nonce)> = {email, h: sha256(code|nonce), exp, tries, state, next?}
// and the link's record (magic:<token>, app/lib/magic-link.ts) carries the same sha256(nonce) as `req`.
//   - the link opened in the browser that asked (the cookie matches) signs in at once (app/api/auth/verify GET);
//     anywhere else it needs the "Sign in on this device" button, so a mail scanner (no cookie) never uses it up;
//   - the code only works together with the cookie, 5 tries, then the whole pending sign-in is dead;
//   - one of them used kills the other (the link only works while this record is pending; using the code drops it);
//   - the tab that asked polls /api/auth/status (pending/done/expired) and goes on via /api/auth/continue.
// 15 minutes, like the link; the request itself has the link's rate limits (app/lib/signin.ts).
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';

export const REQ_COOKIE = 'pg_login_req';
export const DONE_COOKIE = 'pg_login_done'; // set with the link tab's sign-in: proves its cookies reached this browser
export const REQ_PATH = '/api/auth';
export const CODE_TTL_S = 900;
export const CODE_MAX_TRIES = 5;

export type SignInRequest = { email: string; h: string; exp: number; tries: number; state: 'pending' | 'done'; next?: string };

const enc = new TextEncoder();
export async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function sixDigits(): string {
  const a = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(a); if (a[0] < 4_294_000_000) return String(a[0] % 1_000_000).padStart(6, '0'); }
}
// Same length strings, no early exit.
export function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length || !a.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const reqKey = (id: string) => `signin:req:${id}`;
const ttlLeft = (exp: number, now: number) => Math.max(60, Math.ceil((exp - now) / 1000));

// id = sha256(nonce): what the link record and the KV key carry.
export async function createSignInRequest(email: string, now = Date.now()): Promise<{ nonce: string; id: string; code: string }> {
  const nonce = randomHex(32), code = sixDigits(), id = await sha(nonce);
  const rec: SignInRequest = { email, h: await sha(code + '|' + nonce), exp: now + CODE_TTL_S * 1000, tries: 0, state: 'pending' };
  await kvPut(reqKey(id), JSON.stringify(rec), CODE_TTL_S);
  return { nonce, id, code };
}

const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=${REQ_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
export const reqCookie = (nonce: string, maxAge = CODE_TTL_S) => cookie(REQ_COOKIE, nonce, maxAge);
export const doneCookie = (maxAge = CODE_TTL_S) => cookie(DONE_COOKIE, maxAge ? '1' : '', maxAge);

function cookieValue(request: Request, name: string): string {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}
export const nonceOf = (request: Request) => { const n = cookieValue(request, REQ_COOKIE); return /^[0-9a-f]{64}$/.test(n) ? n : ''; };
export const doneSeen = (request: Request) => cookieValue(request, DONE_COOKIE) === '1';
// The request id this browser holds, or ''.
export async function requestIdOf(request: Request): Promise<string> {
  const n = nonceOf(request);
  return n ? sha(n) : '';
}

// The record while it is alive (not expired, not out of tries), else null.
export async function getSignInRequest(id: string, now = Date.now()): Promise<SignInRequest | null> {
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const raw = await kvGet(reqKey(id));
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as SignInRequest;
    return r.exp > now && r.tries < CODE_MAX_TRIES ? r : null;
  } catch { return null; }
}
export const dropSignInRequest = (id: string) => kvDel(reqKey(id));

// The link was used in the browser that asked: the tab that asked may now go on to `next`.
export async function markSignInDone(id: string, rec: SignInRequest, next: string, now = Date.now()): Promise<void> {
  await kvPut(reqKey(id), JSON.stringify({ ...rec, state: 'done', next }), ttlLeft(rec.exp, now));
}

export type ReqState = 'pending' | 'done' | 'expired';
export async function signInState(request: Request): Promise<ReqState> {
  const rec = await getSignInRequest(await requestIdOf(request));
  if (!rec) return 'expired';
  return rec.state === 'done' && doneSeen(request) ? 'done' : 'pending';
}

export type CodeResult = { email: string } | { error: 'wrong'; left: number } | { error: 'expired' };

// The code typed in the browser that asked. Right: the record is dropped (the link dies with it).
export async function checkSignInCode(nonce: string, code: string, now = Date.now()): Promise<CodeResult> {
  if (!/^[0-9a-f]{64}$/.test(nonce)) return { error: 'expired' };
  const id = await sha(nonce);
  const raw = await kvGet(reqKey(id));
  if (!raw) return { error: 'expired' };
  let rec: SignInRequest;
  try { rec = JSON.parse(raw); } catch { await kvDel(reqKey(id)); return { error: 'expired' }; }
  if (!(rec.exp > now) || rec.tries >= CODE_MAX_TRIES || rec.state !== 'pending') { await kvDel(reqKey(id)); return { error: 'expired' }; }
  if (/^\d{6}$/.test(code) && sameHex(await sha(code + '|' + nonce), rec.h)) { await kvDel(reqKey(id)); return { email: rec.email }; }
  const tries = rec.tries + 1;
  if (tries >= CODE_MAX_TRIES) await kvDel(reqKey(id));
  else await kvPut(reqKey(id), JSON.stringify({ ...rec, tries }), ttlLeft(rec.exp, now));
  return { error: 'wrong', left: CODE_MAX_TRIES - tries };
}
