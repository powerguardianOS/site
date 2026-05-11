import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/app/lib/stripe';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, annual } = body;

    if (!plan || !['home', 'pro', 'addon_connector'].includes(plan)) {
      return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });
    }

    if (typeof annual !== 'boolean') {
      return NextResponse.json({ error: 'invalid_annual' }, { status: 400 });
    }

    const url = await createCheckoutSession(plan, annual);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }
}