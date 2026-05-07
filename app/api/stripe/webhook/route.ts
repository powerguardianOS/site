export const runtime = 'edge';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/app/lib/stripe';
import { createLicense, getLicenseByEmail, updateLicense } from '@/app/lib/license-db';
import { sendEmail } from '@/app/lib/email';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  let event: Stripe.Event;
  try {
    event = await getStripeClient().webhooks.constructEventAsync(rawBody, sig, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[stripe webhook] signature failed:', msg);
    return new Response('webhook error', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const plan = session.metadata?.plan as 'home' | 'pro' | undefined;
    const email = session.customer_details?.email ?? session.customer_email ?? null;

    if (!plan || !email) {
      console.warn('[stripe webhook] missing plan or email — session', session.id);
      return new Response('missing metadata', { status: 400 });
    }

    try {
      if (session.metadata?.plan === 'addon_connector') {
        // haal bestaande licentie op en verhoog connector_limit met 1
        // (we nemen aan dat getLicenseByEmail en updateLicense beschikbaar zijn)
        const existing = await getLicenseByEmail(email);
        if (existing) {
          await updateLicense(existing.id, { connector_limit: existing.connector_limit + 1 });
          console.log(`[stripe webhook] license updated: ${email}`);
          return new Response(null, { status: 200 });
        }
      }

      await createLicense({
        email,
        plan,
        site_id: 'default-site',
        connector_limit: plan === 'home' ? 1 : 5,
        expires_at: null,
        notes: `stripe:${session.id}`,
      });
      console.log(`[stripe webhook] license created: ${email} / ${plan}`);
      await sendEmail(
        email,
        'Your PowerGuardian license is active',
        `Hi,\n\nYour PowerGuardian ${plan === 'home' ? 'Home' : 'Pro'} license is now active.\n\nTo link your controller:\n1. Open your PowerGuardian controller\n2. Go to Settings → License\n3. Click "Link License" and enter this email address\n4. Enter the 6-digit code we send you\n\nManage your account at: https://powerguardian.cloud/account\n\n— PowerGuardian`,
      );
    } catch (err) {
      console.error('[stripe webhook] createLicense failed:', err);
    }
  }

  return new Response(null, { status: 200 });
}
