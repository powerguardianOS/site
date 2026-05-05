export const runtime = 'edge';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { getLicenses } from '@/app/lib/license-db';
import LicenseTable from './LicenseTable';

export default async function LicensesPage() {
  const licenses = await getLicenses();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Licenses</h1>
        <Link
          href="/admin/licenses/new"
          className="bg-[#00C66F] text-black px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#00b564] transition-colors"
        >
          + New license
        </Link>
      </div>
      <LicenseTable licenses={licenses} />
    </div>
  );
}
