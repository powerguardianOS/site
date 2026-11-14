export const runtime = 'edge';

// Shared by /api/auth/register and /api/auth/magic: rate limits (per IP and per
// address, KV-backed, fail closed), account upsert, magic link, mail. The link
// is a credential: it only ever goes into the mail, never into a log line.
// LOGIN-2: every request is one pending sign-in bound to this browser (cookie, app/lib/signin-code.ts): the mail has
// the link and a 6-digit code, both for that same sign-in.
import { NextResponse } from 'next/server';
import { getAccount, createAccount } from '@/app/lib/accounts';
import { createMagicToken } from '@/app/lib/magic-link';
import { sendEmail } from '@/app/lib/email';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';
import { siteBase } from '@/app/lib/host';
import { createSignInRequest, reqCookie, doneCookie, CODE_TTL_S } from '@/app/lib/signin-code';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export async function requestSignIn(request: Request, mode: 'register' | 'magic'): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const raw = body?.email;
  if (typeof raw !== 'string' || !EMAIL_RE.test(raw.trim()) || raw.length > 320) {
    return NextResponse.json({ ok: false, error: 'valid email required' }, { status: 400 });
  }
  const email = raw.trim().toLowerCase();

  try {
    if (
      (await rateLimited(`signin:ip:${clientIp(request)}`, 10, 3600, true)) ||
      (await rateLimited(`signin:email:${email}`, 3, 3600, true))
    ) {
      return NextResponse.json({ ok: false, error: 'Too many requests — try again later.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Service unavailable — please try again.' }, { status: 503 });
  }

  let nonce = '';
  try {
    const existing = await getAccount(email);
    if (!existing) await createAccount(email);
    const req = await createSignInRequest(email);
    const token = await createMagicToken(email, req.id);
    const magicUrl = siteBase() + '/api/auth/verify?token=' + token; // always the apex host (LOGIN-1)
    const isNew = mode === 'register' && !existing;
    nonce = req.nonce;
    await sendEmail(
      email,
      isNew ? 'Welcome to PowerGuardian' : `Your PowerGuardian sign-in code: ${req.code}`,
      (isNew ? 'Your account is ready. ' : '')
      + 'Sign in with the link below, or type the code on the page where you asked.'
      + `\n\nYour code: ${req.code}`
      + `\n\nExpires in ${CODE_TTL_S / 60} minutes. Didn't ask? Ignore this email.`
      + '\n\n' + magicUrl + '\n\n— PowerGuardian',
      {
        heading: isNew ? 'Welcome to PowerGuardian' : 'Sign in to PowerGuardian',
        lead: (isNew ? 'Your account is ready. ' : '') + 'Tap the button to sign in, or type the code on the page where you asked.',
        button: { label: 'Sign in', url: magicUrl }, code: req.code,
      },
    );
  } catch (err) {
    // Message only: the error text never contains the link.
    console.error(`[${mode}] sign-in mail not sent:`, err instanceof Error ? err.message : 'error');
    return NextResponse.json({ ok: false, error: 'Could not send the sign-in email — please try again.' }, { status: 503 });
  }
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.headers.append('Set-Cookie', reqCookie(nonce));
  res.headers.append('Set-Cookie', doneCookie(0));
  return res;
}
