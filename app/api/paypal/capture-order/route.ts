export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/app/lib/paypal';
import { createLicense, getLicenseByEmail, updateLicense } from '@/app/lib/license-db';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const orderID: string = body?.orderID;
  const plan: 'home' | 'pro' | 'addon_connector' = body?.plan;

  if (!orderID || !['home', 'pro', 'addon_connector'].includes(plan)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  try {
    const result = await capturePayPalOrder(orderID);
    if (result.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'payment_not_completed' }, { status: 402 });
    }

    await createLicense({
      email: result.email,
      plan,
      site_id: 'default-site',
      connector_limit: plan === 'home' ? 1 : 5,
      expires_at: null,
      notes: `paypal:${orderID}`,
    });

    await resend.emails.send({
      from: 'PowerGuardian <noreply@powerguardian.cloud>',
      to: [result.email],
      subject: 'Your PowerGuardian license is active',
      text: `Hi,\n\nYour PowerGuardian ${plan === 'home' ? 'Home' : 'Pro'} license is now active.\n\nTo link your controller:\n1. Open your PowerGuardian controller\n2. Go to Settings → License\n3. Click "Link License" and enter this email address\n4. Enter the 6-digit code we send you\n\nManage your account at: https://powerguardian.cloud/account\n\n— PowerGuardian`,
    });

    return NextResponse.json({ ok: true, email: result.email });
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
