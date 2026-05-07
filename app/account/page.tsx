import { cookies } from 'next/headers';
import { getAccountSummary } from '@/app/lib/license-db';
import UnderlicensedBanner from './components/UnderlicensedBanner';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const cookieStore = await cookies();
  const email = cookieStore.get('pg_session')?.value ?? '';
  const summary = await getAccountSummary(email);

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-white/40">Total connectors:</span>
            <p className="text-white font-medium">{summary.total_connectors}</p>
          </div>
          <div>
            <span className="text-white/40">Total sites:</span>
            <p className="text-white font-medium">{summary.total_sites}</p>
          </div>
        </div>
      </div>

      {/* Licenses */}
      <div className="space-y-4">
        {summary.licenses.length === 0 && (
          <div className="rounded-xl border border-white/10 p-6 text-white/50 text-sm">
            No active licenses found.{' '}
            <a href="/pricing" className="text-[#00C66F] hover:underline">View plans →</a>
          </div>
        )}

        {summary.licenses.map((lic) => (
          <div key={lic.id} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-[#00C66F] text-black px-2 py-0.5 rounded text-xs font-semibold uppercase">
                  {lic.plan}
                </span>
                <span className="text-sm text-white/60">{lic.site_id || 'default'}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                lic.status === 'active' ? 'bg-green-900/50 text-green-400' :
                lic.status === 'expired' ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-red-900/50 text-red-400'
              }`}>
                {lic.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-white/40">Connectors</span>
                <p className="text-white font-medium">{lic.connector_limit}</p>
              </div>
              <div>
                <span className="text-white/40">Expires</span>
                <p className="text-white font-medium">
                  {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-white/40">License token</span>
              <code className="font-mono text-xs text-white/70 break-all select-all">
                {lic.token}
              </code>
            </div>

            <UnderlicensedBanner connectorLimit={lic.connector_limit} />
          </div>
        ))}
      </div>

      <div className="pt-2">
        <a
          href="/pricing"
          className="text-sm text-[#00C66F] hover:underline"
        >
          + Add connector licenses
        </a>
      </div>
    </div>
  );
}
