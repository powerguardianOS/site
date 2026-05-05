export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { regenToken } from '@/app/lib/license-db';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const license = await regenToken(id);
  if (!license) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(license);
}
