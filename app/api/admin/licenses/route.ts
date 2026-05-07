export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getLicenses, createLicense } from '@/app/lib/license-db';

export async function GET() {
  const licenses = await getLicenses();
  return NextResponse.json(licenses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.email || !body.plan) {
    return NextResponse.json({ error: 'email and plan required' }, { status: 400 });
  }
  if (!['home', 'pro', 'addon_connector'].includes(body.plan)) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 });
  }
  const record = await createLicense({
    email: body.email,
    plan: body.plan as 'home' | 'pro' | 'addon_connector',
    site_id: 'default-site',
    connector_limit: Number(body.connector_limit),
    expires_at: null,
    notes: body.notes ?? 'admin:manual',
  });
  return NextResponse.json({ ok: true, id: record.id });
}
