export const runtime = 'edge';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/app/lib/stripe';
import { createLicense } from '@/app/lib/license-db';

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
      await createLicense({
        email,
        plan,
        connector_limit: plan === 'home' ? 10 : 999,
        expires_at: null,
        notes: `stripe:${session.id}`,
      });
      console.log(`[stripe webhook] license created: ${email} / ${plan}`);
    } catch (err) {
      console.error('[stripe webhook] createLicense failed:', err);
    }
  }

  return new Response(null, { status: 200 });
}
