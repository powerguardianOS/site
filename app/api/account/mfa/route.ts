export const runtime = 'edge';

// CLOUD-MFA: the "Two-step sign-in" card on the account page.
//   GET                                   → { enabled, since, recovery_left, required }
//   POST { action: 'start' }              → { key, otpauth, qr_svg }  (new secret, kept 10 minutes for this account)
//   POST { action: 'confirm', code }      → { enabled: true, recovery_codes }  (shown once)
//   POST { action: 'remove', code }       → { enabled: false }       (needs a current code or a recovery code)
//   POST { action: 'recovery', code }     → { recovery_codes }       (new set; the old ones stop working)
// Signed-in owner only, JSON + same-origin (ownerGuard). Code attempts share the sign-in limit (10 per 15 minutes).
import { ownerGuard } from '@/app/lib/owner';
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { markSessionMfa } from '@/app/lib/session';
import {
  getMfa, deleteMfa, enableMfa, redeemCode, regenerateRecovery, mfaRequired, codeAttemptsExceeded,
  newSecret, sealSecret, openSecret, base32, otpauthUri, qrSvg, groupKey,
} from '@/app/lib/mfa';

const setupKey = (email: string) => `mfa:setup:${email}`;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const wrong = (message = 'That code did not work. Try the newest code from your app.') => json({ error: 'invalid_code', message }, 401);

export async function GET(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const rec = await getMfa(who.email);
  return json({
    enabled: !!rec,
    since: rec?.created_at ?? null,
    recovery_left: rec ? rec.recovery.length : 0,
    required: await mfaRequired(who.email),
  });
}

export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const body = (await request.json().catch(() => null)) as { action?: unknown; code?: unknown } | null;
  const action = body?.action;

  if (action === 'start') {
    if (await getMfa(who.email)) return json({ error: 'already_on', message: 'Two-step sign-in is already on.' }, 409);
    const secret = newSecret();
    await kvPut(setupKey(who.email), await sealSecret(who.email, secret), 600);
    const key = base32(secret);
    const uri = otpauthUri(who.email, key);
    return json({ key: groupKey(key), otpauth: uri, qr_svg: qrSvg(uri, 184) });
  }

  if (action !== 'confirm' && action !== 'remove' && action !== 'recovery') return json({ error: 'unknown_action' }, 400);
  try {
    if (await codeAttemptsExceeded(who.email)) return json({ error: 'too_many', message: 'Too many tries. Wait 15 minutes and try again.' }, 429);
  } catch {
    return json({ error: 'unavailable', message: 'Not available right now. Try again in a minute.' }, 503);
  }

  if (action === 'confirm') {
    const sealed = await kvGet(setupKey(who.email));
    const secret = sealed ? await openSecret(who.email, sealed) : null;
    if (!secret) return json({ error: 'setup_expired', message: 'This setup took too long. Start again.' }, 410);
    const codes = await enableMfa(who.email, secret, String(body?.code ?? ''));
    if (!codes) return wrong();
    await kvDel(setupKey(who.email));
    await markSessionMfa(who.sessionId); // they just proved the app: this session counts as two-step
    return json({ enabled: true, recovery_codes: codes });
  }

  const r = await redeemCode(who.email, body?.code);
  if (!r.ok) return wrong('That code did not work. Use the newest code from your app, or a recovery code.');
  if (action === 'remove') {
    await deleteMfa(who.email);
    return json({ enabled: false });
  }
  return json({ recovery_codes: await regenerateRecovery(who.email) });
}
