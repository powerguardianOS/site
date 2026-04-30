import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/app/lib/stripe';

type Plan = 'home' | 'pro';
type Billing = 'monthly' | 'annual';

const PRICE_MAP: Record<Plan, Record<Billing, string>> = {
  home: {
    monthly: 'STRIPE_PRICE_HOME_MONTHLY',
    annual:  'STRIPE_PRICE_HOME_ANNUAL',
  },
  pro: {
    monthly: 'STRIPE_PRICE_PRO_MONTHLY',
    annual:  'STRIPE_PRICE_PRO_ANNUAL',
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const plan: Plan = body.plan;
  const billing: Billing = body.billing;

  if (!PRICE_MAP[plan] || !PRICE_MAP[plan][billing]) {
    return NextResponse.json({ error: 'invalid plan or billing' }, { status: 400 });
  }

  const priceId = process.env[PRICE_MAP[plan][billing]];
  if (!priceId) {
    return NextResponse.json({ error: 'price not configured' }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://powerguardian.cloud';
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/pricing?success=1`,
    cancel_url:  `${base}/pricing`,
    metadata: { plan, billing },
    customer_email: body.email ?? undefined,
  });

  return NextResponse.json({ url: session.url });
}
