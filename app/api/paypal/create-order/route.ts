export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createPayPalOrder } from '@/app/lib/paypal';
import { getSession } from '@/app/lib/session';
import { getLicenses } from '@/app/lib/license-db';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const plan: string = body?.plan;

  if (plan !== 'home' && plan !== 'pro' && plan !== 'addon_connector') {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 });
  }

  let parentId: string | undefined;
  if (plan === 'addon_connector') {
    // An add-on belongs to ONE site of a signed-in customer: pick it here, check it is theirs.
    const email = await getSession((await cookies()).get('pg_session')?.value ?? '');
    if (!email) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    const site = (await getLicenses()).find((l) => l.id === body?.site_license_id);
    if (!site || site.plan === 'addon_connector' || site.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'site_not_found' }, { status: 404 });
    }
    parentId = site.id;
  }

  try {
    const orderId = await createPayPalOrder(plan, parentId);
    return NextResponse.json({ id: orderId });
  } catch {
    return NextResponse.json({ error: 'paypal_error' }, { status: 500 });
  }
}
