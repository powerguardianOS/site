export const runtime = 'edge';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { getLicenses } from '@/app/lib/license-db';

const MRR_RATES: Record<string, number> = { home: 5, pro: 15 };

export default async function AdminDashboard() {
  const licenses = await getLicenses();

  const active   = licenses.filter(l => l.status === 'active');
  const revoked  = licenses.filter(l => l.status === 'revoked');

  const mrr = active.reduce((sum, l) => sum + (MRR_RATES[l.plan] ?? 0), 0);

  const now = Date.now();
  const soon30 = active.filter(l =>
    l.expires_at && new Date(l.expires_at).getTime() - now < 30 * 86400_000
  );

  const byPlan = ['home', 'pro', 'enterprise', 'lifetime', 'founder'].map(p => ({
    plan: p,
    count: active.filter(l => l.plan === p).length,
  })).filter(p => p.count > 0);

  const recent = [...licenses].reverse().slice(0, 6);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Active licenses', value: active.length, color: 'text-[#00C66F]' },
          { label: 'MRR', value: `€${mrr}`, color: 'text-white', sub: 'subscription only' },
          { label: 'Revoked', value: revoked.length, color: 'text-red-400' },
          { label: 'Expiring ≤30d', value: soon30.length, color: soon30.length ? 'text-amber-400' : 'text-zinc-500' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-400 uppercase tracking-wide">{c.label}</p>
            <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            {c.sub && <p className="text-[10px] text-zinc-600 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        {/* Plan breakdown */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 text-sm font-medium">Plans</div>
          <div className="p-5 space-y-3">
            {byPlan.length === 0 && <p className="text-sm text-zinc-500">No active licenses</p>}
            {byPlan.map(({ plan, count }) => (
              <div key={plan} className="flex items-center gap-3">
                <span className="capitalize text-sm w-24 shrink-0">{plan}</span>
                <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#00C66F]"
                    style={{ width: `${Math.round((count / active.length) * 100)}%` }}
                  />
                </div>
                <span className="text-sm text-zinc-400 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent licenses */}
        <div className="xl:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <span className="text-sm font-medium">Recent</span>
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
                  <td className="px-5 py-2.5">
                    <Link href={`/admin/licenses/${l.id}`} className="hover:text-[#00C66F] transition-colors">
                      {l.email}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 capitalize">{l.plan}</td>
                  <td className="px-5 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${l.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-zinc-400">{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-zinc-500">No licenses yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
