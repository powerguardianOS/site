import { getLicenses } from '@/app/lib/license-db';

export const dynamic = 'force-dynamic';
import Link from 'next/link';

export default async function AdminDashboard() {
  const licenses = await getLicenses();
  const total = licenses.length;
  const active = licenses.filter(l => l.status === 'active').length;
  const revoked = licenses.filter(l => l.status === 'revoked').length;
  const recent = [...licenses].reverse().slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: total, color: 'text-white' },
          { label: 'Active', value: active, color: 'text-[#00C66F]' },
          { label: 'Revoked', value: revoked, color: 'text-red-400' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">{c.label}</p>
            <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <span className="text-sm font-medium">Recent licenses</span>
          <Link href="/admin/licenses" className="text-xs text-[#00C66F] hover:underline">View all →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="text-left px-5 py-2">Email</th>
              <th className="text-left px-5 py-2">Plan</th>
              <th className="text-left px-5 py-2">Status</th>
              <th className="text-left px-5 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {recent.map(l => (
              <tr key={l.id} className="hover:bg-zinc-800/30">
                <td className="px-5 py-3">{l.email}</td>
                <td className="px-5 py-3 capitalize">{l.plan}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${l.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-400">{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-zinc-500">No licenses yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
