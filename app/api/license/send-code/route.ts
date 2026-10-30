export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByEmail } from '@/app/lib/license-db';
import { sendEmail } from '@/app/lib/email';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';
import { kvPut } from '@/app/lib/kv';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 });
  }

  // Limits come before the license lookup so they also slow down anyone
  // probing which addresses hold a license: 10 requests/hour per IP and
  // 3 codes/hour per address (which also caps guessing a 6-digit code).
  if (
    (await rateLimited(`sendcode:ip:${clientIp(req)}`, 10, 3600)) ||
    (await rateLimited(`sendcode:email:${email.toLowerCase()}`, 3, 3600))
  ) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const license = await getLicenseByEmail(email);
  if (!license) {
    return NextResponse.json({ error: 'no_license' }, { status: 404 });
  }

  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = (100000 + (buf[0] % 900000)).toString();
  const expires = Date.now() + 15 * 60 * 1000;
  try { await kvPut(`otp:${email.toLowerCase()}`, JSON.stringify({ code, expires })); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503 }); }

  await sendEmail(
    email,
    'Your PowerGuardian activation code',
    `Your activation code is: ${code}\n\nEnter this code in Settings → License on your controller.\nThis code expires in 15 minutes.\n\n— PowerGuardian`,
    { code },
  );

  return NextResponse.json({ sent: true });
}
