export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

async function kvGet(key: string): Promise<string | null> {
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (r.status === 404) return null;
  return r.text();
}

async function kvDel(key: string): Promise<void> {
  await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email;
  const code: string | undefined = body?.code;

  if (!email || !code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const raw = await kvGet(`otp:${email.toLowerCase()}`);
  if (!raw) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  try {
    const { code: stored, expires } = JSON.parse(raw);
    await kvDel(`otp:${email.toLowerCase()}`);

    if (expires < Date.now()) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
    if (stored !== code) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
