export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { fulfilPurchase } from '@/app/lib/purchase';
import { sendEmail } from '@/app/lib/email';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const orderID: string = body?.orderID;
  if (!orderID || typeof orderID !== 'string') {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  try {
    // The client's idea of the plan is ignored on purpose: the order itself says what was bought.
    const r = await fulfilPurchase(orderID);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

    const what = r.plan === 'addon_connector' ? 'connector add-on' : `${r.plan === 'home' ? 'Home' : 'Pro'} license`;
    await sendEmail(
      r.email,
      'Your PowerGuardian purchase is active',
      `Hi,\n\nYour PowerGuardian ${what} is now active.\n\nTo link your controller:\n1. Open your PowerGuardian controller\n2. Go to Settings → License\n3. Click "Link License" and enter this email address\n4. Enter the 6-digit code we send you\n\nManage your account at: https://powerguardian.cloud/account\n\n— PowerGuardian`,
    );
    return NextResponse.json({ ok: true, email: r.email });
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
