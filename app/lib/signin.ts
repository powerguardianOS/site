export const runtime = 'edge';

// Shared by /api/auth/register and /api/auth/magic: rate limits (per IP and per
// address, KV-backed, fail closed), account upsert, magic link, mail. The link
// is a credential: it only ever goes into the mail, never into a log line.
import { NextResponse } from 'next/server';
import { getAccount, createAccount } from '@/app/lib/accounts';
import { createMagicToken } from '@/app/lib/magic-link';
import { sendEmail } from '@/app/lib/email';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';
import { siteBase } from '@/app/lib/host';
import { createSignInCode, codeCookie, CODE_TTL_S } from '@/app/lib/signin-code';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export async function requestSignIn(request: Request, mode: 'register' | 'magic'): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const raw = body?.email;
  if (typeof raw !== 'string' || !EMAIL_RE.test(raw.trim()) || raw.length > 320) {
    return NextResponse.json({ ok: false, error: 'valid email required' }, { status: 400 });
  }
  const email = raw.trim().toLowerCase();
  const wantCode = body?.code === true; // also a 6-digit code for this browser (app/lib/signin-code.ts)

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

  let bind = '';
  try {
    const existing = await getAccount(email);
    if (!existing) await createAccount(email);
    const token = await createMagicToken(email);
    const magicUrl = siteBase() + '/api/auth/verify?token=' + token; // always the apex host (LOGIN-1)
    const isNew = mode === 'register' && !existing;
    const c = wantCode ? await createSignInCode(email) : null;
    bind = c?.bind ?? '';
    await sendEmail(
      email,
      isNew ? 'Welcome to PowerGuardian' : c ? `Your PowerGuardian sign-in code: ${c.code}` : 'Sign in to PowerGuardian',
      (c ? `Your sign-in code is ${c.code}\n\nType it in the app or page where you asked for it. It works once, for ${CODE_TTL_S / 60} minutes.\n\nOr ` : '')
      + (isNew ? 'Your account has been created.\n\nClick the link below to sign in:'
             : 'Click the link below to sign in to your PowerGuardian account:')
      + '\n\n' + magicUrl + '\n\nThis link expires in 15 minutes. If you did not request this, ignore this email.\n\n— PowerGuardian',
      { button: { label: 'Sign in to PowerGuardian', url: magicUrl } },
    );
  } catch (err) {
    // Message only: the error text never contains the link.
    console.error(`[${mode}] sign-in mail not sent:`, err instanceof Error ? err.message : 'error');
    return NextResponse.json({ ok: false, error: 'Could not send the sign-in email — please try again.' }, { status: 503 });
  }
  const res = NextResponse.json({ ok: true, ...(bind ? { code: true } : {}) });
  if (bind) res.headers.append('Set-Cookie', codeCookie(bind));
  return res;
}
