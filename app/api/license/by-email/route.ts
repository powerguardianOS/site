export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByEmail } from '@/app/lib/license-db';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const license = await getLicenseByEmail(email);

  if (!license) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    plan: license.plan,
    connector_limit: license.connector_limit,
    expires_at: license.expires_at,
    token: license.token,
  });
}
