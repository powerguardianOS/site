import { getLicenses } from '@/app/lib/license-db';

export const dynamic = 'force-dynamic';
import Link from 'next/link';
import LicenseActions from './LicenseActions';

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

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-400 border-b border-zinc-800 bg-zinc-800/30">
            <tr>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Plan</th>
              <th className="text-left px-5 py-3">Connectors</th>
              <th className="text-left px-5 py-3">Expires</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Notes</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {licenses.map(l => (
              <tr key={l.id} className="hover:bg-zinc-800/20">
                <td className="px-5 py-3 font-mono text-xs">{l.email}</td>
                <td className="px-5 py-3 capitalize">{l.plan}</td>
                <td className="px-5 py-3">{l.connector_limit === 0 ? '∞' : l.connector_limit}</td>
                <td className="px-5 py-3 text-zinc-400">{l.expires_at ? new Date(l.expires_at).toLocaleDateString() : 'Never'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${l.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-500 text-xs max-w-xs truncate">{l.notes || '—'}</td>
                <td className="px-5 py-3">
                  <LicenseActions id={l.id} status={l.status} />
                </td>
              </tr>
            ))}
            {licenses.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-zinc-500">No licenses yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
