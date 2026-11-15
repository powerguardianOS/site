export const runtime = 'edge';

// PASSKEYS-1: passwordless sign-in, step 2. POST { credential } (same origin, JSON, from the browser that got the
// challenge). A verified passkey (user verification required) is both factors: the session gets mfa:true and the
// browser goes on like after the e-mail link (a controller's sign-in, a site switch, or the account).
// Limits: 20 tries per IP and the account's code limit (10 per 15 minutes) — as for codes.
import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin } from '@/app/lib/page-html';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';
import { codeAttemptsExceeded } from '@/app/lib/mfa';
import { finishAssertion, ownerOfAssertion, passkeyHint, PK_COOKIE, PK_PATH } from '@/app/lib/passkeys';
import { WebAuthnError } from '@/app/lib/webauthn';
import { withSession, signInTarget, clearSignInNext } from '@/app/lib/signin-step';
import { logAudit } from '@/app/lib/audit';
import { activityCtx } from '@/app/lib/client-info';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const clearCookie = (res: NextResponse) => { res.cookies.set(PK_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: PK_PATH, maxAge: 0 }); return res; };

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ ok: false, error: 'origin' }, 403);
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json({ ok: false, error: 'json' }, 415);
  // B2: expect = the hint of the address typed on /login (optional); a passkey of another account is then refused.
  const body = (await request.json().catch(() => null)) as { credential?: unknown; expect?: unknown } | null;
  const cred = (body?.credential && typeof body.credential === 'object' ? body.credential : {}) as never;
  const owner = await ownerOfAssertion(cred);
  try {
    if (await rateLimited(`pk:verify:ip:${clientIp(request)}`, 20, 900, true)) return json({ ok: false, error: 'too_many' }, 429);
    if (owner && await codeAttemptsExceeded(owner)) return json({ ok: false, error: 'too_many' }, 429);
  } catch {
    return json({ ok: false, error: 'unavailable' }, 503);
  }
  const bind = request.cookies.get(PK_COOKIE)?.value ?? '';
  try {
    if (!/^[0-9a-f]{64}$/.test(bind)) throw new WebAuthnError('challenge');
    if (typeof body?.expect === 'string' && owner && body.expect !== await passkeyHint(owner)) throw new WebAuthnError('other_account');
    const r = await finishAssertion('signin', 'cookie:' + bind, cred);
    await logAudit({ actor: r.email, role: 'owner', action: 'signin.passkey', email: r.email, detail: r.name });
    const target = signInTarget(request);
    const res = await withSession(json({ ok: true, next: target, hint: await passkeyHint(r.email) }), r.email, true, request, { method: 'passkey' });
    clearSignInNext(request, res);
    return clearCookie(res);
  } catch (e) {
    const code = e instanceof WebAuthnError ? e.code : 'error';
    // B2 (review): a passkey of another account than the typed address is that person's own choice in the browser
    // dialog, not an attack on the passkey's account: nothing goes into that account's activity.
    if (owner && code !== 'other_account') await logAudit({ actor: owner, role: 'owner', action: 'signin.passkey_refused', email: owner, detail: code, ...activityCtx(request) });
    const error = code === 'unknown_credential' ? 'unknown' : code === 'challenge' ? 'expired' : 'failed';
    return clearCookie(json({ ok: false, error }, 401));
  }
}
