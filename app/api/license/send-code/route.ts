export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByEmail } from '@/app/lib/license-db';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

async function kvPut(key: string, value: string): Promise<void> {
  await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
    body: value,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  const license = await getLicenseByEmail(email);
  if (!license) {
    return NextResponse.json({ error: 'no_license' }, { status: 404 });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 15 * 60 * 1000;
  await kvPut(`otp:${email.toLowerCase()}`, JSON.stringify({ code, expires }));

  await resend.emails.send({
    from: 'PowerGuardian <noreply@powerguardian.cloud>',
    to: [email],
    subject: 'Your PowerGuardian activation code',
    text: `Your activation code is: ${code}\n\nEnter this code in Settings → License on your controller.\nThis code expires in 15 minutes.\n\n— PowerGuardian`,
  });

  return NextResponse.json({ sent: true });
}
