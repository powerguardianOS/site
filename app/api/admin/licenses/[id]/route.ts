import { NextResponse } from 'next/server';
import { getLicenses, updateLicense, revokeLicense } from '@/app/lib/license-db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const licenses = await getLicenses();
  const license = licenses.find(l => l.id === id);
  if (!license) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(license);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const license = await updateLicense(id, body);
  if (!license) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(license);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const success = await revokeLicense(id);
  if (!success) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
