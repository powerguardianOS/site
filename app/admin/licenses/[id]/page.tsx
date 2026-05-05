export const runtime = 'edge';
export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getLicenses } from '@/app/lib/license-db';
import LicenseEditor from './LicenseEditor';

export default async function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const licenses = await getLicenses();
  const license = licenses.find(l => l.id === id);
  if (!license) notFound();
  return <LicenseEditor license={license} />;
}
