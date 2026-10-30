export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getLicenses, updateLicense } from '@/app/lib/license-db';
import { sendEmail } from '@/app/lib/email';
import { verifyPayPalWebhook } from '@/app/lib/paypal';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  // Unsigned or wrongly signed events change nothing.
  const verdict = await verifyPayPalWebhook(req.headers, body);
  if (verdict === 'not_configured') return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  if (verdict !== 'ok') return NextResponse.json({ error: 'invalid signature' }, { status: 401 });

  const eventType: string = body.event_type ?? '';
  const subscriptionID: string = body.resource?.id ?? '';

  if (
    (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') &&
    subscriptionID
  ) {
    const licenses = await getLicenses();
    const record = licenses.find(l => l.notes?.includes(`paypal-sub:${subscriptionID}`));

    if (record) {
      await updateLicense(record.id, { status: 'expired' });

      await sendEmail(
        record.email,
        'Your PowerGuardian subscription has ended',
        `Hi,\n\nYour PowerGuardian ${record.plan} subscription has ended.\n\nYour license is no longer active. To continue using PowerGuardian, renew your plan at:\nhttps://powerguardian.cloud/pricing\n\n— PowerGuardian`,
      );
    }
  }

  return NextResponse.json({ ok: true });
}
