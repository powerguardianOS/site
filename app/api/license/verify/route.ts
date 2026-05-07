export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByToken } from '@/app/lib/license-db';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const key: string | undefined = body?.license_key;
  const connector_count: number | undefined = body?.connector_count;

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const license = await getLicenseByToken(key);

  if (!license || license.status !== 'active') {
    return NextResponse.json({ valid: false });
  }

  let status: 'valid' | 'underlicensed' | 'expired' | 'invalid' = 'valid';

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    status = 'expired';
    return NextResponse.json({ valid: false, status });
  }

  if (license.connector_limit > 0 && connector_count !== undefined && connector_count > license.connector_limit) {
    status = 'underlicensed';
  }

  return NextResponse.json({
    valid: true,
    status,
    plan: license.plan,
    connector_limit: license.connector_limit,
    expires_at: license.expires_at,
  });
}
