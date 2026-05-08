export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getAccount, createAccount } from '@/app/lib/accounts';
import { createMagicToken } from '@/app/lib/magic-link';
import { sendEmail } from '@/app/lib/email';

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const existing = await getAccount(email);
  if (!existing) await createAccount(email);

  const token = await createMagicToken(email);
  const magicUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://powerguardian.cloud') + '/api/auth/verify?token=' + token;

  try {
    await sendEmail(
      email,
      existing ? 'Sign in to PowerGuardian' : 'Welcome to PowerGuardian',
      (existing
        ? 'Click the link below to sign in to your PowerGuardian account:'
        : 'Your account has been created.\n\nClick the link below to sign in:')
      + '\n\n' + magicUrl + '\n\nThis link expires in 15 minutes.\n\n— PowerGuardian',
    );
  } catch (err) {
    console.error('[register] Email failed:', err);
    console.log('[register] FALLBACK URL:', magicUrl);
  }

  return NextResponse.json({ ok: true });
}
