export const runtime = 'edge';

// Sign in with a 6-digit code from the e-mail (next to the link), for a browser that cannot open the link itself: the
// installed home-screen app has its own cookie jar and a mail link opens in Safari or Gmail, and a controller's sign-in
// or site switch runs in that same app. The code is bound to the browser that asked: an HttpOnly cookie holds a random
// secret; KV keeps only hashes (signin:code:<sha256(secret)> = {email, h: sha256(code|secret), exp, tries}).
// 15 minutes, single use, 5 tries; the request itself has the link's rate limits (app/lib/signin.ts).
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';

export const CODE_COOKIE = 'pg_code';
export const CODE_PATH = '/api/auth/code';
export const CODE_TTL_S = 900;
export const CODE_MAX_TRIES = 5;

const enc = new TextEncoder();
async function sha(s: string): Promise<string> {
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

export async function createSignInCode(email: string, now = Date.now()): Promise<{ bind: string; code: string }> {
  const bind = randomHex(32), code = sixDigits();
  await kvPut(`signin:code:${await sha(bind)}`, JSON.stringify({ email, h: await sha(code + '|' + bind), exp: now + CODE_TTL_S * 1000, tries: 0 }), CODE_TTL_S);
  return { bind, code };
}

export const codeCookie = (bind: string, maxAge = CODE_TTL_S) =>
  `${CODE_COOKIE}=${bind}; Path=${CODE_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

export type CodeResult = { email: string } | { error: 'wrong'; left: number } | { error: 'expired' };

export async function checkSignInCode(bind: string, code: string, now = Date.now()): Promise<CodeResult> {
  if (!/^[0-9a-f]{64}$/.test(bind)) return { error: 'expired' };
  const key = `signin:code:${await sha(bind)}`;
  const raw = await kvGet(key);
  if (!raw) return { error: 'expired' };
  let rec: { email: string; h: string; exp: number; tries: number };
  try { rec = JSON.parse(raw); } catch { await kvDel(key); return { error: 'expired' }; }
  if (!(rec.exp > now) || rec.tries >= CODE_MAX_TRIES) { await kvDel(key); return { error: 'expired' }; }
  if (/^\d{6}$/.test(code) && (await sha(code + '|' + bind)) === rec.h) { await kvDel(key); return { email: rec.email }; }
  const tries = rec.tries + 1;
  if (tries >= CODE_MAX_TRIES) await kvDel(key);
  else await kvPut(key, JSON.stringify({ ...rec, tries }), Math.max(60, Math.ceil((rec.exp - now) / 1000)));
  return { error: 'wrong', left: CODE_MAX_TRIES - tries };
}
