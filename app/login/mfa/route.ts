export const runtime = 'edge';

// CLOUD-MFA: the two-step page of the sign-in (after the sign-in link, before the session).
//   verify: "Enter the 6-digit code from your authenticator app" (or a recovery code).
//   setup:  accounts that manage sites must turn it on first: QR code, "Add to authenticator app" on phones, the key to
//           type by hand, then the code. Afterwards the 10 recovery codes are shown once.
// Same-origin POST only; 5 tries per pending sign-in and 10 per account per 15 minutes, then a new link is needed.
// PASSKEYS-1: a passkey is the other second step. verify: "Use a passkey" (when the account has one) next to the code;
// setup: "Use a passkey" as the first choice, the authenticator app below. The page loads public/mfa-passkey.js, which
// talks JSON to POST /login/mfa?passkey=options|verify|register-options|register (same cookie, same limits).
import { NextResponse } from 'next/server';
import { page, esc, sameOrigin, CSP_PASSKEY } from '@/app/lib/page-html';
import { twoStep, passkeyHint, requestOptions, creationOptions, finishAssertion, finishRegistration } from '@/app/lib/passkeys';
import { WebAuthnError } from '@/app/lib/webauthn';
import { logAudit } from '@/app/lib/audit';
import { getPending, savePending, dropPending, stepCookieValue, withSession, STEP_MAX_TRIES, type PendingSignIn } from '@/app/lib/signin-step';
import { getSession } from '@/app/lib/session';
import { activityCtx } from '@/app/lib/client-info';
import { redeemCode, enableMfa, openSecret, base32, otpauthUri, qrSvg, groupKey, codeAttemptsExceeded } from '@/app/lib/mfa';

const gone = (request: Request, why: 'timeout' | 'codes') =>
  NextResponse.redirect(new URL('/login?error=' + why, request.url), { status: 303, headers: { 'Cache-Control': 'no-store' } });
// LOGIN-2: the two-step page can be open in two tabs (the mail link's and the one that asked); once one finished, the
// other goes to the account instead of "took too long". A session only exists after the full sign-in.
const timedOut = async (request: Request) => {
  const raw = /(?:^|;\s*)pg_session=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1] ?? '';
  let cookie = ''; try { cookie = decodeURIComponent(raw); } catch { /* not ours */ }
  if (cookie && await getSession(cookie).catch(() => null)) {
    return NextResponse.redirect(new URL('/account', request.url), { status: 303, headers: { 'Cache-Control': 'no-store' } });
  }
  return gone(request, 'timeout');
};

const codeInput = (autofocus: boolean) =>
  `<label for="mfa-code" class="small" style="display:block;text-align:left;margin:0 0 6px">6-digit code</label>` +
  `<input id="mfa-code" name="code" class="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" ` +
  `maxlength="7" placeholder="123456" required${autofocus ? ' autofocus' : ''}>`;

const PK_HEAD = { 'Content-Security-Policy': CSP_PASSKEY };
const PK_SCRIPT = '<script src="/mfa-passkey.js" defer></script>';
const pkError = '<p class="err" id="pk-error" role="alert" hidden></p>';

async function render(p: PendingSignIn, error = '', status = 200): Promise<Response> {
  const err = error ? `<p class="err" id="mfa-error" role="alert">${esc(error)}</p>` : '';
  if (p.mode === 'verify') {
    const ts = await twoStep(p.email);
    const pk = ts.passkeys > 0
      ? `<div class="card" id="pk-box" data-pk="verify" hidden>${pkError}<button type="button" id="mfa-passkey">Use a passkey</button>` +
        `<p class="small" style="margin-top:12px">Face ID, Touch ID, Windows Hello or your phone.</p></div>` +
        (ts.totp ? '' : `<p class="small" id="pk-unsupported" hidden style="margin-top:16px">This browser cannot use passkeys. Open the sign-in link on the device with your passkey, or use a recovery code.</p>`)
      : '';
    const app = ts.totp
      ? (pk ? `<p class="or" id="pk-or" hidden>or</p>` : '') +
        `<form method="post" action="/login/mfa" class="card">${err}${codeInput(!pk)}<button type="submit" id="mfa-submit"${pk ? ' class="secondary" style="margin-top:0"' : ''}>Sign in</button></form>`
      : (err ? `<div class="card">${err}</div>` : '');
    return page(status, 'Two-step sign-in',
      `<p>${ts.totp && pk ? 'Use a passkey, or enter the 6-digit code from your authenticator app.' : ts.totp ? 'Enter the 6-digit code from your authenticator app.' : 'Confirm it is you with your passkey.'}</p>` +
      pk + app +
      `<details style="margin-top:16px"><summary class="small" style="cursor:pointer;text-align:center;list-style:none">${ts.totp ? 'Lost your phone?' : 'Lost your passkey?'} Use a recovery code</summary>` +
      `<form method="post" action="/login/mfa" class="card"><label for="mfa-recovery" class="small" style="display:block;text-align:left;margin:0 0 6px">Recovery code</label>` +
      `<input id="mfa-recovery" name="recovery" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="abcde-fghij" required>` +
      `<button type="submit" id="mfa-recovery-submit">Sign in with recovery code</button><p class="small" style="margin-top:12px">Each recovery code works once.</p></form></details>` +
      (pk ? PK_SCRIPT : ''), pk ? PK_HEAD : {});
  }
  const secret = p.setup_secret ? await openSecret(p.email, p.setup_secret) : null;
  if (!secret) return page(503, 'Two-step sign-in is not available right now', '<p>Please try again in a few minutes.</p>');
  const key = base32(secret);
  const uri = otpauthUri(p.email, key);
  return page(status, 'Set up two-step sign-in',
    `<p>Your account manages sites, so signing in needs a second step: a passkey on this device, or a code from an authenticator app on your phone.</p>` +
    `<div class="card" id="pk-box" data-pk="setup" hidden><p style="margin-bottom:12px"><b>Recommended:</b> a passkey (Face ID, Touch ID, Windows Hello or your phone)</p>${pkError}` +
    `<button type="button" id="mfa-passkey-setup">Add a passkey</button></div><p class="or" id="pk-or" hidden>or use an authenticator app</p>` +
    `<div class="card">` +
    `<p style="margin-bottom:12px"><b>1.</b> Add PowerGuardian to your authenticator app (for example Google Authenticator, Microsoft Authenticator or 1Password)</p>` +
    `<a class="btn phone-only" id="mfa-add-app" href="${esc(uri)}">Add to authenticator app</a>` +
    `<div class="qr" id="mfa-qr" style="display:flex;justify-content:center;margin:12px 0">${qrSvg(uri)}</div>` +
    `<p class="small">Or scan the code, or type this key:</p><p id="mfa-key" style="font-family:ui-monospace,Menlo,monospace;color:#fafafa;overflow-wrap:anywhere;font-size:15px;-webkit-user-select:all;user-select:all">${esc(groupKey(key))}</p>` +
    `</div>` +
    `<form method="post" action="/login/mfa" class="card"><p style="margin-bottom:12px"><b>2.</b> Type the code the app shows</p>${err}${codeInput(false)}` +
    `<button type="submit" id="mfa-submit">Turn on and sign in</button></form>` + PK_SCRIPT, PK_HEAD);
}

const pkJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// The passkey half of this page (JSON, called by public/mfa-passkey.js).
async function passkeyStep(request: Request, action: string, id: string, p: PendingSignIn): Promise<Response> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return pkJson({ ok: false, error: 'json' }, 415);
  const bind = 'step:' + id;
  if (action === 'options') {
    if (p.mode !== 'verify' || (await twoStep(p.email)).passkeys === 0) return pkJson({ ok: false, error: 'no_passkey' }, 409);
    return pkJson({ ok: true, publicKey: await requestOptions('step', bind, p.email) });
  }
  if (action === 'register-options') {
    if (p.mode !== 'setup') return pkJson({ ok: false, error: 'not_setup' }, 409);
    return pkJson({ ok: true, publicKey: await creationOptions('step-register', bind, p.email) });
  }
  if (action !== 'verify' && action !== 'register') return pkJson({ ok: false, error: 'unknown' }, 400);
  if (action === 'verify' ? p.mode !== 'verify' : p.mode !== 'setup') return pkJson({ ok: false, error: 'wrong_mode' }, 409);
  const body = (await request.json().catch(() => null)) as { credential?: unknown; device?: unknown } | null;

  let limited: boolean;
  try { limited = await codeAttemptsExceeded(p.email); } catch { return pkJson({ ok: false, error: 'unavailable' }, 503); }
  if (limited) { await dropPending(id); return pkJson({ ok: false, error: 'too_many', next: '/login?error=codes' }, 429); }

  try {
    if (action === 'verify') {
      const r = await finishAssertion('step', bind, (body?.credential ?? {}) as never, p.email);
      await dropPending(id);
      await logAudit({ actor: p.email, role: 'owner', action: 'signin.passkey', email: p.email, detail: `two-step · ${r.name}` });
      return withSession(pkJson({ ok: true, next: p.next, hint: await passkeyHint(p.email) }), p.email, true, request, { method: p.method, via: 'passkey' });
    }
    const r = await finishRegistration('step-register', bind, p.email, (body?.credential ?? {}) as never, '', body?.device);
    await dropPending(id);
    await logAudit({ actor: p.email, role: 'owner', action: 'passkey.add', email: p.email, detail: r.passkey.name, ...activityCtx(request) });
    return withSession(pkJson({ ok: true, next: p.next, hint: await passkeyHint(p.email), recovery_codes: r.recovery_codes ?? [] }), p.email, true, request, { method: p.method, via: 'passkey' });
  } catch (e) {
    const code = e instanceof WebAuthnError ? e.code : 'error';
    if (action === 'verify') await logAudit({ actor: p.email, role: 'owner', action: 'signin.passkey_refused', email: p.email, detail: code, ...activityCtx(request) });
    const tries = p.tries + 1;
    if (tries >= STEP_MAX_TRIES) { await dropPending(id); return pkJson({ ok: false, error: 'too_many', next: '/login?error=codes' }, 401); }
    await savePending(id, { ...p, tries });
    return pkJson({ ok: false, error: code === 'cred_exists' ? 'exists' : 'failed', left: STEP_MAX_TRIES - tries }, 401);
  }
}

export async function GET(request: Request) {
  const p = await getPending(stepCookieValue(request));
  if (!p) return timedOut(request);
  return render(p);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return page(403, 'This sign-in did not start here', '<p><a href="/login">Back to sign in</a></p>');
  const id = stepCookieValue(request);
  const p = await getPending(id);
  const action = new URL(request.url).searchParams.get('passkey');
  if (action !== null) return p ? passkeyStep(request, action, id, p) : pkJson({ ok: false, error: 'timeout', next: '/login?error=timeout' }, 410);
  if (!p) return timedOut(request);
  const form = await request.formData().catch(() => null);
  const code = String(form?.get('code') ?? form?.get('recovery') ?? '');

  let limited: boolean;
  try { limited = await codeAttemptsExceeded(p.email); } catch { return page(503, 'Sign-in is not available right now', '<p>Please try again in a minute.</p>'); }
  if (limited) { await dropPending(id); return gone(request, 'codes'); }

  if (p.mode === 'verify') {
    const r = await redeemCode(p.email, code);
    if (r.ok) {
      await dropPending(id);
      if (r.via === 'recovery') {
        const res = page(200, 'Signed in with a recovery code',
          `<p>That recovery code is now used up. You have <b id="mfa-left">${r.left}</b> left.</p>` +
          `<p>${r.left && r.left > 3 ? 'You can make new ones on your account page.' : 'Make new ones on your account page soon, or set up your authenticator app again.'}</p>` +
          `<div class="card"><a class="btn" id="mfa-continue" href="${esc(p.next)}">Continue</a></div>`);
        return withSession(new NextResponse(res.body, res), p.email, true, request, { method: p.method, via: 'recovery' });
      }
      return withSession(NextResponse.redirect(new URL(p.next, request.url), 303), p.email, true, request, { method: p.method, via: 'totp' });
    }
  } else {
    const secret = p.setup_secret ? await openSecret(p.email, p.setup_secret) : null;
    const codes = secret ? await enableMfa(p.email, secret, code) : null;
    if (codes) {
      await dropPending(id);
      const res = page(200, 'Save your recovery codes',
        `<p>Two-step sign-in is on. If you lose your phone, each of these codes lets you sign in once. Keep them somewhere safe, like a password manager. They are shown only now.</p>` +
        `<div class="card"><ol id="mfa-codes" style="margin:0;padding-left:28px;font-family:ui-monospace,Menlo,monospace;font-size:16px;line-height:1.9;color:#fafafa;-webkit-user-select:all;user-select:all">` +
        codes.map((c) => `<li>${esc(c)}</li>`).join('') + `</ol></div>` +
        `<div class="card"><a class="btn" id="mfa-continue" href="${esc(p.next)}">I saved my recovery codes</a></div>`);
      await logAudit({ actor: p.email, role: 'owner', action: 'mfa.on', email: p.email, detail: 'at sign-in', ...activityCtx(request) });
      return withSession(new NextResponse(res.body, res), p.email, true, request, { method: p.method, via: 'totp' });
    }
  }
  // SESSIONS-1: a wrong code after a valid first step is worth telling the owner (repeats within an hour count up).
  await logAudit({ actor: p.email, role: 'owner', action: 'auth.mfa_failed', email: p.email, detail: 'at sign-in', ...activityCtx(request) });

  const tries = p.tries + 1;
  if (tries >= STEP_MAX_TRIES) { await dropPending(id); return gone(request, 'codes'); }
  await savePending(id, { ...p, tries });
  return render({ ...p, tries }, `That code did not work. Check the time on your phone and try the newest code. ${STEP_MAX_TRIES - tries} ${STEP_MAX_TRIES - tries === 1 ? 'try' : 'tries'} left.`, 401);
}
