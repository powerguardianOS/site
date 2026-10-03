export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getAccount } from '@/app/lib/accounts';
import { getLicenses } from '@/app/lib/license-db';
import { LicenseCard } from './LicenseCard';

export default async function CustomerPage({ params }: { params: Promise<{ email: string }> }) {
  const email = decodeURIComponent((await params).email).toLowerCase();
  const [account, all] = await Promise.all([getAccount(email), getLicenses()]);
  const licenses = all
    .filter(l => l.email.toLowerCase() === email)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300">← Admin</Link>
        <h1 className="text-2xl font-semibold mt-2 break-all">{email}</h1>
        <p className="text-xs text-zinc-500 mt-1">
          {account ? `Registered ${new Date(account.created_at).toLocaleDateString()}` : 'Not registered yet'}
          {' · '}{licenses.length} license{licenses.length === 1 ? '' : 's'}
        </p>
      </div>

      {licenses.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 p-8 text-center text-sm text-zinc-500">
          No licenses for this customer.
        </div>
      ) : licenses.map(l => (
        // Deliberately no `token` prop: the license token is never rendered anywhere.
        <LicenseCard key={l.id} license={{
          id: l.id, plan: l.plan, status: l.status, connector_limit: l.connector_limit,
          expires_at: l.expires_at, notes: l.notes, created_at: l.created_at,
        }} />
      ))}

      <Link
        href="/admin/licenses/new"
        className="inline-block border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-lg px-3 py-1.5 text-xs transition-colors"
      >
        + Add license
      </Link>
    </div>
  );
}
