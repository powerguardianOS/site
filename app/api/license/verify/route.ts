export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByToken } from '@/app/lib/license-db';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const key: string | undefined = body?.license_key;

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const license = await getLicenseByToken(key);

  if (!license || license.status !== 'active') {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    plan: license.plan,
    connector_limit: license.connector_limit,
    expires_at: license.expires_at,
  });
}
