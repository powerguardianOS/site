export const runtime = 'edge';

// CLOUD-MFA: the two-step page of the sign-in (after the sign-in link, before the session).
//   verify: "Enter the 6-digit code from your authenticator app" (or a recovery code).
//   setup:  accounts that manage sites must turn it on first: QR code, "Add to authenticator app" on phones, the key to
//           type by hand, then the code. Afterwards the 10 recovery codes are shown once.
// Same-origin POST only; 5 tries per pending sign-in and 10 per account per 15 minutes, then a new link is needed.
import { NextResponse } from 'next/server';
import { page, esc, sameOrigin } from '@/app/lib/page-html';
import { getPending, savePending, dropPending, stepCookieValue, withSession, STEP_MAX_TRIES, type PendingSignIn } from '@/app/lib/signin-step';
import { redeemCode, enableMfa, openSecret, base32, otpauthUri, qrSvg, groupKey, codeAttemptsExceeded } from '@/app/lib/mfa';

const gone = (request: Request, why: 'timeout' | 'codes') =>
  NextResponse.redirect(new URL('/login?error=' + why, request.url), { status: 303, headers: { 'Cache-Control': 'no-store' } });

const codeInput = (autofocus: boolean) =>
  `<label for="mfa-code" class="small" style="display:block;text-align:left;margin:0 0 6px">6-digit code</label>` +
  `<input id="mfa-code" name="code" class="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" ` +
  `maxlength="7" placeholder="123456" required${autofocus ? ' autofocus' : ''}>`;

async function render(p: PendingSignIn, error = '', status = 200): Promise<Response> {
  const err = error ? `<p class="err" id="mfa-error" role="alert">${esc(error)}</p>` : '';
  if (p.mode === 'verify') {
    return page(status, 'Two-step sign-in',
      `<p>Enter the 6-digit code from your authenticator app.</p>` +
      `<form method="post" action="/login/mfa" class="card">${err}${codeInput(true)}<button type="submit" id="mfa-submit">Sign in</button></form>` +
      `<details style="margin-top:16px"><summary class="small" style="cursor:pointer;text-align:center;list-style:none">Lost your phone? Use a recovery code</summary>` +
      `<form method="post" action="/login/mfa" class="card"><label for="mfa-recovery" class="small" style="display:block;text-align:left;margin:0 0 6px">Recovery code</label>` +
      `<input id="mfa-recovery" name="recovery" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="abcde-fghij" required>` +
      `<button type="submit" id="mfa-recovery-submit">Sign in with recovery code</button><p class="small" style="margin-top:12px">Each recovery code works once.</p></form></details>`);
  }
  const secret = p.setup_secret ? await openSecret(p.email, p.setup_secret) : null;
  if (!secret) return page(503, 'Two-step sign-in is not available right now', '<p>Please try again in a few minutes.</p>');
  const key = base32(secret);
  const uri = otpauthUri(p.email, key);
  return page(status, 'Set up two-step sign-in',
    `<p>Your account manages sites, so signing in needs a second step: a code from an authenticator app on your phone (for example Google Authenticator, Microsoft Authenticator or 1Password).</p>` +
    `<div class="card">` +
    `<p style="margin-bottom:12px"><b>1.</b> Add PowerGuardian to your authenticator app</p>` +
    `<a class="btn phone-only" id="mfa-add-app" href="${esc(uri)}">Add to authenticator app</a>` +
    `<div class="qr" id="mfa-qr" style="display:flex;justify-content:center;margin:12px 0">${qrSvg(uri)}</div>` +
    `<p class="small">Or scan the code, or type this key:</p><p id="mfa-key" style="font-family:ui-monospace,Menlo,monospace;color:#fafafa;overflow-wrap:anywhere;font-size:15px;-webkit-user-select:all;user-select:all">${esc(groupKey(key))}</p>` +
    `</div>` +
    `<form method="post" action="/login/mfa" class="card"><p style="margin-bottom:12px"><b>2.</b> Type the code the app shows</p>${err}${codeInput(false)}` +
    `<button type="submit" id="mfa-submit">Turn on and sign in</button></form>`);
}

export async function GET(request: Request) {
  const p = await getPending(stepCookieValue(request));
  if (!p) return gone(request, 'timeout');
  return render(p);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return page(403, 'This sign-in did not start here', '<p><a href="/login">Back to sign in</a></p>');
  const id = stepCookieValue(request);
  const p = await getPending(id);
  if (!p) return gone(request, 'timeout');
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
        return withSession(new NextResponse(res.body, res), p.email, true);
      }
      return withSession(NextResponse.redirect(new URL(p.next, request.url), 303), p.email, true);
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
      return withSession(new NextResponse(res.body, res), p.email, true);
    }
  }

  const tries = p.tries + 1;
  if (tries >= STEP_MAX_TRIES) { await dropPending(id); return gone(request, 'codes'); }
  await savePending(id, { ...p, tries });
  return render({ ...p, tries }, `That code did not work. Check the time on your phone and try the newest code. ${STEP_MAX_TRIES - tries} ${STEP_MAX_TRIES - tries === 1 ? 'try' : 'tries'} left.`, 401);
}
