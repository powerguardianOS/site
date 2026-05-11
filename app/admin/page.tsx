export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { getAccounts } from '@/app/lib/accounts';
import { getLicenses } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { ExportButton } from './ExportButton';

export default async function AdminPage() {
  const [accounts, licenses] = await Promise.all([getAccounts(), getLicenses()]);

  const licenseMap = new Map<string, LicenseRecord[]>();
  for (const lic of licenses) {
    const key = lic.email.toLowerCase();
    if (!licenseMap.has(key)) licenseMap.set(key, []);
    licenseMap.get(key)!.push(lic);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="flex items-center gap-2">
          <ExportButton />
          <p className="text-sm text-zinc-400">{accounts.length} accounts · {licenses.filter(l => l.status === 'active').length} active licenses</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Registered</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 text-sm">No accounts yet.</td>
              </tr>
            ) : accounts.map((account) => {
              const lics = licenseMap.get(account.email) ?? [];
              const active = lics.find(l => l.status === 'active');
              return (
                <tr key={account.email} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{account.email}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(account.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {active ? (
                      <span className="bg-[#00C66F]/20 text-[#00C66F] px-2 py-0.5 rounded text-xs font-medium uppercase">{active.plan}</span>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {active ? (
                      <span className="bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full text-xs">active</span>
                    ) : (
                      <span className="bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full text-xs">no license</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}