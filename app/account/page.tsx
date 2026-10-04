import { cookies } from 'next/headers';
import { getAccountSummary } from '@/app/lib/license-db';
import UnderlicensedBanner from './components/UnderlicensedBanner';
import SitesSection from './components/SitesSection';
import { getSession } from '@/app/lib/session';
import { effectiveLimit } from '@/app/lib/limits';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pg_session')?.value ?? '';
  const email = (await getSession(sessionId)) ?? '';
  const summary = await getAccountSummary(email);
  // Connector add-ons belong to a site and only raise its capacity — they are not licenses of their own here.
  const siteLicenses = summary.licenses.filter((l) => l.plan !== 'addon_connector');
  const capacity = (l: (typeof siteLicenses)[number]) => effectiveLimit(l, summary.licenses);
  const totalConnectors = siteLicenses.some((l) => l.connector_limit === 0)
    ? 'Unlimited'
    : String(siteLicenses.reduce((n, l) => n + capacity(l), 0));

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-white/40">Total connectors:</span>
            <p className="text-white font-medium">{totalConnectors}</p>
          </div>
          <div>
            <span className="text-white/40">Total sites:</span>
            <p className="text-white font-medium">{summary.total_sites}</p>
          </div>
        </div>
      </div>

      {/* Sites — real status from controller heartbeats */}
      <SitesSection licenses={summary.licenses.filter(l => l.plan !== 'addon_connector').map(l => ({
        id: l.id, plan: l.plan, status: l.status,
        info: {
          id: l.id, name: l.site_name ?? null, hostname: l.claimed_hostname ?? null,
          controllerShort: l.claimed_by ? l.claimed_by.slice(0, 8) : null, offlineAllowed: l.offline_allowed === true,
          copies: (l.copies ?? []).map(c => ({ controller_id: c.controller_id, hostname: c.hostname, first_seen: c.first_seen, decision: c.decision })),
          movedAway: (l.retired ?? []).filter(r => r.reason === 'moved' && new Date(r.until).getTime() > Date.now()).map(r => ({ until: r.until })),
        },
      }))} />

      {/* Licenses */}
      <div className="space-y-4">
        {siteLicenses.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold text-white">No active license</h2>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto">
              Your account is created but you do not have an active plan yet. Choose a plan to start monitoring your UPS infrastructure.
            </p>
            <a href="/pricing" className="inline-flex px-6 py-3 rounded-full bg-[#00C66F] text-black font-medium text-sm hover:bg-[#00b564] transition">
              Upgrade now
            </a>
          </div>
        )}

        {siteLicenses.map((lic) => (
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
                <p className="text-white font-medium">{lic.connector_limit === 0 ? 'Unlimited' : capacity(lic)}</p>
              </div>
              <div>
                <span className="text-white/40">Expires</span>
                <p className="text-white font-medium">
                  {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>

            <UnderlicensedBanner connectorLimit={capacity(lic)} />
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
