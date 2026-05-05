export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getLicenses, createLicense } from '@/app/lib/license-db';

export async function GET() {
  const licenses = await getLicenses();
  return NextResponse.json(licenses);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.email || !body.plan) {
    return NextResponse.json({ error: 'email and plan required' }, { status: 400 });
  }
  const license = await createLicense({
    email: body.email,
    plan: body.plan,
    connector_limit: Number(body.connector_limit ?? 0),
    expires_at: body.expires_at || null,
    notes: body.notes || '',
  });
  return NextResponse.json(license, { status: 201 });
}
