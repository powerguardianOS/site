export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createMagicToken } from '@/app/lib/magic-link';
import { sendEmail } from '@/app/lib/email';
import { getAccount, createAccount } from '@/app/lib/accounts';

// KV helpers for rate limiting
const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

const kvGet = async (key: string): Promise<string | null> => {
  const res = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.text();
};

const kvPut = async (key: string, value: string): Promise<void> => {
  await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
    body: value,
  });
};

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
  const window = Math.floor(Date.now() / 600000);
  const rateLimitKey = 'ratelimit:magic:' + ip + ':' + window;
  const current = await kvGet(rateLimitKey);
  const count = current ? parseInt(current) : 0;
  if (count >= 3) {
    return NextResponse.json({ ok: false, error: 'Too many requests — try again in 10 minutes.' }, { status: 429 });
  }
  await kvPut(rateLimitKey, String(count + 1));

  // Upsert account if it doesn't exist yet (preserves created_at on repeat requests)
  const existingAccount = await getAccount(email);
  if (!existingAccount) {
    await createAccount(email);
  }

  const token = await createMagicToken(email);
  const magicUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://powerguardian.cloud') + '/api/auth/verify?token=' + token;

  try {
    await sendEmail(
      email,
      'Sign in to PowerGuardian',
      'Click the link below to sign in to your PowerGuardian account:\n\n' + magicUrl + '\n\nThis link expires in 15 minutes. If you did not request this, ignore this email.\n\n— PowerGuardian',
    );
  } catch (err) {
    console.error('[magic] email failed:', err);
    return NextResponse.json({ ok: false, error: 'Failed to send email — please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
