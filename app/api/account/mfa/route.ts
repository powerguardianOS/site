export const runtime = 'edge';

// CLOUD-MFA: the "Two-step sign-in" card on the account page.
//   GET                                   → { enabled, since, recovery_left, required }
//   POST { action: 'start' }              → { key, otpauth, qr_svg }  (new secret, kept 10 minutes for this account)
//   POST { action: 'confirm', code }      → { enabled: true, recovery_codes }  (shown once)
//   POST { action: 'remove', code }       → { enabled: false }       (needs a current code or a recovery code)
//   POST { action: 'recovery', code }     → { recovery_codes }       (new set; the old ones stop working)
// PASSKEYS-1: 'remove' and 'recovery' also take { credential } (a passkey of this account, confirm challenge from
// /api/account/passkeys). Removing the app keeps the recovery codes while the account still has a passkey.
// Signed-in owner only, JSON + same-origin (ownerGuard). Code attempts share the sign-in limit (10 per 15 minutes).
import { ownerGuard } from '@/app/lib/owner';
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { markSessionMfa } from '@/app/lib/session';
import { twoStep, confirmFresh } from '@/app/lib/passkeys';
import {
  getMfa, saveMfa, deleteMfa, enableMfa, regenerateRecovery, mfaRequired, codeAttemptsExceeded,
  newSecret, sealSecret, openSecret, base32, otpauthUri, qrSvg, groupKey,
} from '@/app/lib/mfa';

const setupKey = (email: string) => `mfa:setup:${email}`;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const wrong = (message = 'That code did not work. Try the newest code from your app.') => json({ error: 'invalid_code', message }, 401);

export async function GET(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const [rec, ts] = await Promise.all([getMfa(who.email), twoStep(who.email)]);
  return json({
    enabled: !!rec?.totp,
    passkeys: ts.passkeys,
    since: rec?.created_at ?? null,
    recovery_left: rec && ts.on ? rec.recovery.length : 0,
    required: await mfaRequired(who.email),
  });
}

export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const body = (await request.json().catch(() => null)) as { action?: unknown; code?: unknown; credential?: unknown } | null;
  const action = body?.action;

  if (action === 'start') {
    if ((await getMfa(who.email))?.totp) return json({ error: 'already_on', message: 'Two-step sign-in is already on.' }, 409);
    const secret = newSecret();
    await kvPut(setupKey(who.email), await sealSecret(who.email, secret), 600);
    const key = base32(secret);
    const uri = otpauthUri(who.email, key);
    return json({ key: groupKey(key), otpauth: uri, qr_svg: qrSvg(uri, 184) });
  }

  if (action !== 'confirm' && action !== 'remove' && action !== 'recovery') return json({ error: 'unknown_action' }, 400);

  if (action === 'confirm') {
    try {
      if (await codeAttemptsExceeded(who.email)) return json({ error: 'too_many', message: 'Too many tries. Wait 15 minutes and try again.' }, 429);
    } catch {
      return json({ error: 'unavailable', message: 'Not available right now. Try again in a minute.' }, 503);
    }
    const sealed = await kvGet(setupKey(who.email));
    const secret = sealed ? await openSecret(who.email, sealed) : null;
    if (!secret) return json({ error: 'setup_expired', message: 'This setup took too long. Start again.' }, 410);
    const codes = await enableMfa(who.email, secret, String(body?.code ?? ''));
    if (!codes) return wrong();
    await kvDel(setupKey(who.email));
    await markSessionMfa(who.sessionId); // they just proved the app: this session counts as two-step
    return json({ enabled: true, recovery_codes: codes });
  }

  const before = await twoStep(who.email);
  if (action === 'remove' ? !before.totp : !before.on) return json({ error: 'not_on', message: 'Two-step sign-in is off.' }, 409);
  const ok = await confirmFresh(who.email, who.sessionId, body);
  if (!ok.ok) return json({ error: ok.error, message: ok.message }, ok.status);
  if (action === 'remove') {
    const rec = await getMfa(who.email);
    if ((await twoStep(who.email)).passkeys > 0) { if (rec) await saveMfa(who.email, { ...rec, totp: '', last_step: 0 }); }
    else await deleteMfa(who.email);
    return json({ enabled: false });
  }
  return json({ recovery_codes: await regenerateRecovery(who.email) });
}
