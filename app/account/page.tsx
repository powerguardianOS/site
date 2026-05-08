import { cookies } from 'next/headers';
import { getAccountSummary, getLicensesByEmail } from '@/app/lib/license-db';
import UnderlicensedBanner from './components/UnderlicensedBanner';
import { getSession } from '@/app/lib/session';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pg_session')?.value ?? '';
  const email = (await getSession(sessionId)) ?? '';
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

      {/* Controller Status */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Controller Status</h2>
        {summary.licenses.length === 0 && (
          <p className="text-xs text-zinc-500">Connect a controller to start monitoring your UPS.</p>
        )}
        {summary.licenses.length > 0 && (
          <div className="space-y-3">
            {summary.licenses.map((lic) => (
              <div key={lic.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`
                    w-2 h-2 rounded-full ${
                      lic.status === 'active' && (lic.plan === 'pro' || lic.plan === 'founder')
                        ? 'bg-green-400' : 'bg-zinc-500'
                    }
                  `} />
                  <span className="text-white/80">
                    {lic.status === 'active' && (lic.plan === 'pro' || lic.plan === 'founder')
                      ? 'Controller online'
                      : 'Controller not connected'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {lic.status === 'active' && (lic.plan === 'pro' || lic.plan === 'founder') ? (
                    <a
                      href={`https://pg-relay.powerguardian.workers.dev/console/${lic.token}`}
                      target="_blank"
                      className="text-[#00C66F] hover:underline"
                    >
                      Open Console →
                    </a>
                  ) : lic.plan === 'home' ? (
                    <span className="text-zinc-500">
                      Pro feature — upgrade to unlock
                      <a href="/pricing" className="text-xs text-zinc-500 underline ml-1">
                        Learn more
                      </a>
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">Install the controller OS and enter your license token to connect.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Licenses */}
      <div className="space-y-4">
        {summary.licenses.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold text-white">No active license</h2>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto">
              Your account is created but you don't have an active plan yet. Choose a plan to start monitoring your UPS infrastructure.
            </p>
            <a href="/pricing" className="inline-flex px-6 py-3 rounded-full bg-[#00C66F] text-black font-medium text-sm hover:bg-[#00b564] transition">
              Upgrade now
            </a>
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
