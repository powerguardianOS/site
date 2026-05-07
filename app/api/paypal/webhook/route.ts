export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getLicenses, updateLicense } from '@/app/lib/license-db';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

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

      await resend.emails.send({
        from: 'PowerGuardian <noreply@powerguardian.cloud>',
        to: [record.email],
        subject: 'Your PowerGuardian subscription has ended',
        text: `Hi,\n\nYour PowerGuardian ${record.plan} subscription has ended.\n\nYour license is no longer active. To continue using PowerGuardian, renew your plan at:\nhttps://powerguardian.cloud/pricing\n\n— PowerGuardian`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
