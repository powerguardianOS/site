export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/app/lib/paypal';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const plan: string = body?.plan;

  if (plan !== 'home' && plan !== 'pro') {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 });
  }

  try {
    const orderId = await createPayPalOrder(plan);
    return NextResponse.json({ id: orderId });
  } catch {
    return NextResponse.json({ error: 'paypal_error' }, { status: 500 });
  }
}
