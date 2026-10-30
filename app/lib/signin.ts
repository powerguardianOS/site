export const runtime = 'edge';

// Shared by /api/auth/register and /api/auth/magic: rate limits (per IP and per
// address, KV-backed, fail closed), account upsert, magic link, mail. The link
// is a credential: it only ever goes into the mail, never into a log line.
import { NextResponse } from 'next/server';
import { getAccount, createAccount } from '@/app/lib/accounts';
import { createMagicToken } from '@/app/lib/magic-link';
import { sendEmail } from '@/app/lib/email';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';

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

  try {
    const existing = await getAccount(email);
    if (!existing) await createAccount(email);
    const token = await createMagicToken(email);
    const magicUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://powerguardian.cloud') + '/api/auth/verify?token=' + token;
    const isNew = mode === 'register' && !existing;
    await sendEmail(
      email,
      isNew ? 'Welcome to PowerGuardian' : 'Sign in to PowerGuardian',
      (isNew ? 'Your account has been created.\n\nClick the link below to sign in:'
             : 'Click the link below to sign in to your PowerGuardian account:')
      + '\n\n' + magicUrl + '\n\nThis link expires in 15 minutes. If you did not request this, ignore this email.\n\n— PowerGuardian',
      { button: { label: 'Sign in to PowerGuardian', url: magicUrl } },
    );
  } catch (err) {
    // Message only: the error text never contains the link.
    console.error(`[${mode}] sign-in mail not sent:`, err instanceof Error ? err.message : 'error');
    return NextResponse.json({ ok: false, error: 'Could not send the sign-in email — please try again.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
