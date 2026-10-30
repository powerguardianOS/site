export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByToken } from '@/app/lib/license-db';

// Called by the relay worker (server-to-server) on every controller /connect
// and periodically while a tunnel is open. Authenticated with the shared
// RELAY_MINT_SECRET. Only the licence's CURRENT token is accepted: a rotated
// token must stop opening tunnels.

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function POST(req: NextRequest) {
  const secret = process.env.RELAY_MINT_SECRET;
  if (!secret) return NextResponse.json({ error: 'relay not configured' }, { status: 503 });
  if (!safeEqual(req.headers.get('X-Mint-Secret') ?? '', secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    return NextResponse.json({ valid: false });
  }

  let license;
  try { license = await getLicenseByToken(token); } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  if (!license || license.status !== 'active') return NextResponse.json({ valid: false });
  if (license.token.toLowerCase() !== token.toLowerCase()) return NextResponse.json({ valid: false });
  if (license.expires_at && new Date(license.expires_at) < new Date()) return NextResponse.json({ valid: false });

  return NextResponse.json({ valid: true, license_id: license.id });
}
