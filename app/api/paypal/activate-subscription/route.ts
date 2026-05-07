export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getPayPalToken } from '@/app/lib/paypal';
import { createLicense, getLicenseByEmail, updateLicense } from '@/app/lib/license-db';
import { sendEmail } from '@/app/lib/email';
const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === '1'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const subscriptionID: string = body?.subscriptionID;
  const plan: 'home' | 'pro' | 'addon_connector' = body?.plan;

  if (!subscriptionID || !['home', 'pro', 'addon_connector'].includes(plan)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  try {
    const token = await getPayPalToken();
    const subRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sub = await subRes.json();
    const email: string = sub.subscriber?.email_address;
    if (!email) return NextResponse.json({ error: 'no_email' }, { status: 400 });

    if (plan === 'addon_connector') {
      const existing = await getLicenseByEmail(email);
      if (!existing) return NextResponse.json({ error: 'no_license' }, { status: 404 });
      const newLimit = existing.connector_limit + 1;
      await updateLicense(existing.id, { connector_limit: newLimit });
      await sendEmail(
        email,
        'Connector add-on activated (monthly)',
        `Hi,\n\nYour monthly connector add-on is active. You now have ${newLimit} connector(s) on your plan.\n\nManage your account at: https://powerguardian.cloud/account\n\n— PowerGuardian`,
      );
    } else {
      await createLicense({
        email,
        plan,
        site_id: 'default-site',
        connector_limit: plan === 'home' ? 1 : 5,
        expires_at: null,
        notes: `paypal-sub:${subscriptionID}`,
      });
      await sendEmail(
        email,
        'Your PowerGuardian license is active',
        `Hi,\n\nYour PowerGuardian ${plan === 'home' ? 'Home' : 'Pro'} monthly subscription is now active.\n\nTo link your controller:\n1. Open your PowerGuardian controller\n2. Go to Settings → License\n3. Click "Link License" and enter this email address\n4. Enter the 6-digit code we send you\n\nManage your account at: https://powerguardian.cloud/account\n\n— PowerGuardian`,
      );
    }

    return NextResponse.json({ ok: true, email });
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
