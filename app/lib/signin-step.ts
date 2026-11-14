// CLOUD-MFA: the step between "the sign-in link was confirmed" and "the session exists". When the account has two-step
// sign-in (or must set it up because it manages sites), no session is made yet: a pending sign-in (KV, 10 minutes,
// 5 code tries) is kept under a random id in an HttpOnly cookie that only /login/mfa receives.
import { NextResponse } from 'next/server';
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { createSession } from '@/app/lib/session';
import { getMfa, mfaRequired, newSecret, sealSecret } from '@/app/lib/mfa';

export const STEP_COOKIE = 'pg_signin';
export const STEP_PATH = '/login/mfa';
export const STEP_TTL_S = 600;
export const STEP_MAX_TRIES = 5;

export type PendingSignIn = {
  email: string;
  next: string;                 // where the browser goes afterwards (/account or the SSO authorize page)
  mode: 'verify' | 'setup';
  setup_secret?: string;        // sealed new secret (setup mode)
  tries: number;
  exp: number;
};

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const stepKey = (id: string) => `signin:step:${id}`;

export function stepCookieValue(request: Request): string {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === STEP_COOKIE) return v.join('=');
  }
  return '';
}

export async function getPending(id: string): Promise<PendingSignIn | null> {
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const raw = await kvGet(stepKey(id));
  if (!raw) return null;
  try { const p = JSON.parse(raw) as PendingSignIn; return p.exp > Date.now() ? p : null; } catch { return null; }
}
export const savePending = (id: string, p: PendingSignIn) => kvPut(stepKey(id), JSON.stringify(p), STEP_TTL_S);
export const dropPending = (id: string) => kvDel(stepKey(id));

const cookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: STEP_PATH };

// Sets pg_session and the security headers on a response that ends a sign-in.
export async function withSession(res: NextResponse, email: string, mfa: boolean): Promise<NextResponse> {
  res.cookies.set('pg_session', await createSession(email, { mfa }), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400, path: '/' });
  res.cookies.set(STEP_COOKIE, '', { ...cookieOpts, maxAge: 0 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

// After the sign-in link is confirmed: straight in, or on to the two-step page.
export async function afterLinkConfirmed(request: Request, email: string, next: string): Promise<NextResponse> {
  const rec = await getMfa(email);
  const mode: PendingSignIn['mode'] | null = rec ? 'verify' : (await mfaRequired(email)) ? 'setup' : null;
  if (!mode) return withSession(NextResponse.redirect(new URL(next, request.url), 303), email, false);
  const id = randomHex(32);
  await savePending(id, {
    email, next, mode, tries: 0, exp: Date.now() + STEP_TTL_S * 1000,
    ...(mode === 'setup' ? { setup_secret: await sealSecret(email, newSecret()) } : {}),
  });
  const res = NextResponse.redirect(new URL(STEP_PATH, request.url), 303);
  res.cookies.set(STEP_COOKIE, id, { ...cookieOpts, maxAge: STEP_TTL_S });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
