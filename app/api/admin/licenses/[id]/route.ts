export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { getLicenses, updateLicense, deleteLicense } from '@/app/lib/license-db';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const licenses = await getLicenses();
  const license = licenses.find(l => l.id === id);
  if (!license) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(license);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json();
  const license = await updateLicense(id, body);
  if (!license) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(license);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteLicense(id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

