// B2 (review): adding a second step (a passkey, the authenticator app) needs a fresh proof on top of the session, so a
// stolen pg_session cookie can never turn on two-step for an attacker, take the recovery codes and lock the owner out.
//   two-step ON  → one of the account's own second steps: a passkey, an authenticator code or a recovery code
//                  (confirmFresh, app/lib/passkeys.ts). An e-mail code alone is not enough then.
//   two-step OFF → the e-mail confirmation code (sendReconfirmCode / verifyReconfirmCode, app/lib/owner.ts): proof of the
//                  mailbox, the same proof the sign-in itself rests on.
// A passed step-up is a grant for this session only (KV stepup:<sha256(session cookie)>, 10 minutes). Adding a passkey
// or confirming the authenticator app uses it up.
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { twoStep, confirmFresh } from '@/app/lib/passkeys';
import { sendReconfirmCode, verifyReconfirmCode } from '@/app/lib/owner';
import { rateLimited } from '@/app/lib/ratelimit';
import { maskEmail } from '@/app/lib/magic-link';

export const STEP_UP_TTL_S = 600;
const enc = new TextEncoder();
const keyOf = async (sessionId: string) =>
  'stepup:' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('pg step-up|' + sessionId)))].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function hasStepUp(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try { return (await kvGet(await keyOf(sessionId))) === '1'; } catch { return false; } // fail closed
}
export async function spendStepUp(sessionId: string): Promise<void> {
  await kvDel(await keyOf(sessionId)).catch(() => {});
}
async function grant(sessionId: string): Promise<void> {
  await kvPut(await keyOf(sessionId), '1', STEP_UP_TTL_S);
}

export const STEP_UP_REQUIRED = { error: 'step_up', message: 'Confirm it is you first.' };

export type StepUpStart =
  | { status: 200; body: { need: 'second'; passkey: boolean; totp: boolean } | { need: 'email'; to: string } }
  | { status: number; body: { error: string; message: string } };

// What this account must show. Two-step off: the code goes out by mail now.
export async function startStepUp(email: string): Promise<StepUpStart> {
  const ts = await twoStep(email);
  if (ts.on) return { status: 200, body: { need: 'second', passkey: ts.passkeys > 0, totp: ts.totp } };
  try {
    if (await rateLimited(`reconfirm:${email}`, 5, 3600, true)) return { status: 429, body: { error: 'too_many', message: 'Too many codes asked for. Try again in an hour.' } };
    await sendReconfirmCode(email);
  } catch {
    return { status: 503, body: { error: 'unavailable', message: 'Could not send the code. Try again in a minute.' } };
  }
  return { status: 200, body: { need: 'email', to: maskEmail(email) } };
}

// Checks the proof for this account's current state; on success this session holds the grant.
export async function verifyStepUp(email: string, sessionId: string, body: { code?: unknown; credential?: unknown } | null):
  Promise<{ ok: true } | { ok: false; status: number; error: string; message: string }> {
  const ts = await twoStep(email);
  if (ts.on) {
    const r = await confirmFresh(email, sessionId, body);
    if (!r.ok) return r;
  } else if (!(await verifyReconfirmCode(email, sessionId, body?.code))) {
    return { ok: false, status: 401, error: 'invalid_code', message: 'That code is wrong or has expired.' };
  }
  await grant(sessionId);
  return { ok: true };
}
