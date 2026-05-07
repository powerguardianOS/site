export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createMagicToken } from '@/app/lib/magic-link';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
  }

  const token = await createMagicToken(email);
  const magicUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://powerguardian.cloud') + '/api/auth/verify?token=' + token;
  await resend.emails.send({
    from: 'PowerGuardian <noreply@powerguardian.cloud>',
    to: [email],
    subject: 'Sign in to PowerGuardian',
    text: 'Click the link below to sign in to your PowerGuardian account:\n\n' + magicUrl + '\n\nThis link expires in 15 minutes. If you did not request this, ignore this email.\n\n— PowerGuardian',
  });

  return NextResponse.json({ ok: true });
}
