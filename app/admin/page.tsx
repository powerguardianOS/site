export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getAccounts } from '@/app/lib/accounts';
import { getLicenses } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { ExportButton } from './ExportButton';
import { displayStatus, STATUS_STYLE } from './status';
import { getSiteStatus, isOnline } from '@/app/lib/site-status';

export default async function AdminPage() {
  const [accounts, licenses] = await Promise.all([getAccounts(), getLicenses()]);

  const byEmail = new Map<string, LicenseRecord[]>();
  for (const lic of licenses) {
    const key = lic.email.toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(lic);
  }

  // Customers = accounts ∪ anyone who holds a license (a license can be issued
  // to an address that never registered).
  const created = new Map(accounts.map(a => [a.email.toLowerCase(), a.created_at]));
  const emails = Array.from(new Set([...created.keys(), ...byEmail.keys()])).sort();

  // Live status per customer: a license (not an add-on) is one site; it is
  // online when its controller heartbeat is recent.
  const siteLicenses = licenses.filter(l => l.plan !== 'addon_connector' && displayStatus(l) === 'active');
  const statuses = await Promise.all(siteLicenses.map(l => getSiteStatus(l.id)));
  const sites = new Map<string, { online: number; total: number }>();
  siteLicenses.forEach((l, i) => {
    const key = l.email.toLowerCase();
    const cur = sites.get(key) ?? { online: 0, total: 0 };
    cur.total += 1;
    if (isOnline(statuses[i])) cur.online += 1;
    sites.set(key, cur);
  });

  const counts = { active: 0, expired: 0, revoked: 0 };
  for (const l of licenses) counts[displayStatus(l)]++;

  const stats = [
    { label: 'Customers', value: emails.length },
    { label: 'Active licenses', value: counts.active },
    { label: 'Expired', value: counts.expired },
    { label: 'Revoked', value: counts.revoked },
    { label: 'Sites online', value: Array.from(sites.values()).reduce((n, v) => n + v.online, 0) },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="flex items-center gap-2">
          <ExportButton />
          <Link
            href="/admin/licenses/new"
            className="bg-[#00C66F] text-black hover:bg-[#00b564] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            + New license
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950/50">
            <tr>
              {['Email', 'Registered', 'Plan', 'Status', 'Expires', 'Sites', 'Licenses'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {emails.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 text-sm">No customers yet.</td>
              </tr>
            ) : emails.map(email => {
              const lics = byEmail.get(email) ?? [];
              const best = lics.find(l => displayStatus(l) === 'active') ?? lics[0];
              const st = best ? displayStatus(best) : null;
              return (
                <tr key={email} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${encodeURIComponent(email)}`} className="text-white font-medium hover:text-[#00C66F]">
                      {email}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {created.get(email) ? new Date(created.get(email)!).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {best ? (
                      <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs font-medium uppercase">{best.plan}</span>
                    ) : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {st ? (
                      <span className={`${STATUS_STYLE[st]} px-2 py-0.5 rounded-full text-xs`}>{st}</span>
                    ) : (
                      <span className="bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full text-xs">no license</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {best ? (best.expires_at ? new Date(best.expires_at).toLocaleDateString() : 'never') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {sites.get(email) ? (
                      <span className="inline-flex items-center gap-1.5 text-zinc-300">
                        <span className={`h-1.5 w-1.5 rounded-full ${sites.get(email)!.online > 0 ? 'bg-green-400' : 'bg-zinc-600'}`} />
                        {sites.get(email)!.online}/{sites.get(email)!.total} online
                      </span>
                    ) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{lics.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
