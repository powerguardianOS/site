export const runtime = 'edge';

// PASSKEYS-1: passkeys on the account page (signed-in owner only, JSON + same origin via ownerGuard).
//   GET                                          → { passkeys: [{ id, name, created_at, last_used_at, synced }], totp }
//   POST { action: 'options' }                   → { publicKey }   creation options (challenge bound to this session)
//   POST { action: 'register', credential, name?, device? }
//                                                → { passkey, recovery_codes|null }  (codes when two-step was off)
//   POST { action: 'confirm-options' }           → { publicKey }   for a fresh confirmation with one of this
//                                                                  account's passkeys (remove, new recovery codes)
//   POST { action: 'remove', id, credential | code }  → { removed: true }   fresh confirmation required
// The account is always the session's; nothing in the body can name another one.
import { ownerGuard } from '@/app/lib/owner';
import { getSessionInfo, markSessionMfa } from '@/app/lib/session';
import { codeAttemptsExceeded } from '@/app/lib/mfa';
import {
  getPasskeys, twoStep, creationOptions, requestOptions, finishRegistration, removePasskey, confirmFresh, viewOf, MAX_PASSKEYS,
} from '@/app/lib/passkeys';
import { WebAuthnError } from '@/app/lib/webauthn';
import { logAudit } from '@/app/lib/audit';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const [acc, ts] = await Promise.all([getPasskeys(who.email), twoStep(who.email)]);
  return json({ passkeys: (acc?.creds ?? []).map(viewOf), totp: ts.totp });
}

export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const body = (await request.json().catch(() => null)) as { action?: unknown; credential?: unknown; name?: unknown; device?: unknown; id?: unknown; code?: unknown } | null;
  const action = body?.action;
  const bind = 'session:' + who.sessionId;

  if (action === 'options' || action === 'register') {
    // With two-step on, only a session that passed it may add a second step (sign-in always enforces this; belt and braces).
    const [ts, info] = await Promise.all([twoStep(who.email), getSessionInfo(who.sessionId)]);
    if (ts.on && !info?.mfa) return json({ error: 'needs_two_step', message: 'Sign in again with your second step first.' }, 403);
    if (ts.passkeys >= MAX_PASSKEYS) return json({ error: 'too_many_passkeys', message: `You can add up to ${MAX_PASSKEYS} passkeys.` }, 409);
    if (action === 'options') return json({ publicKey: await creationOptions('register', bind, who.email) });
    try {
      if (await codeAttemptsExceeded(who.email)) return json({ error: 'too_many', message: 'Too many tries. Wait 15 minutes and try again.' }, 429);
    } catch {
      return json({ error: 'unavailable', message: 'Not available right now. Try again in a minute.' }, 503);
    }
    try {
      const r = await finishRegistration('register', bind, who.email, (body?.credential ?? {}) as never, body?.name, body?.device);
      await markSessionMfa(who.sessionId); // a verified passkey was just used on this session
      await logAudit({ actor: who.email, role: 'owner', action: 'passkey.add', email: who.email, detail: r.passkey.name });
      return json(r);
    } catch (e) {
      const code = e instanceof WebAuthnError ? e.code : 'error';
      return json({ error: code === 'cred_exists' ? 'exists' : 'invalid_passkey',
        message: code === 'cred_exists' ? 'This passkey is already added.' : code === 'challenge' ? 'This took too long. Try again.' : 'That passkey could not be added. Try again.' }, 400);
    }
  }

  if (action === 'confirm-options') {
    if ((await twoStep(who.email)).passkeys === 0) return json({ error: 'no_passkey' }, 409);
    return json({ publicKey: await requestOptions('confirm', bind, who.email) });
  }

  if (action === 'remove') {
    const id = typeof body?.id === 'string' ? body.id : '';
    const acc = await getPasskeys(who.email);
    const target = acc?.creds.find((c) => c.id === id);
    if (!target) return json({ error: 'not_found', message: 'That passkey is not on this account.' }, 404);
    const ok = await confirmFresh(who.email, who.sessionId, body);
    if (!ok.ok) return json({ error: ok.error, message: ok.message }, ok.status);
    await removePasskey(who.email, id);
    await logAudit({ actor: who.email, role: 'owner', action: 'passkey.remove', email: who.email, detail: `${target.name} · confirmed with ${ok.via}` });
    return json({ removed: true });
  }

  return json({ error: 'unknown_action' }, 400);
}
