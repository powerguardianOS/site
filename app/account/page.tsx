import { cookies } from 'next/headers';
import { getAccountSummary } from '@/app/lib/license-db';
import SitesSection, { UnusedLicenses } from './components/SitesSection';
import TwoStepCard from './components/TwoStepCard';
import { getSession } from '@/app/lib/session';
import { getMfa, mfaRequired } from '@/app/lib/mfa';
import { sitesWithStatus } from '@/app/lib/site-summary';
import { accountView } from '@/app/lib/account-view';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// ACCOUNT-UI: "My sites". One calm tile per site (details live in the console), then one quiet line for licenses not in
// use and one for the account. Never internal ids ('default-site') or hostnames as names.
export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pg_session')?.value ?? '';
  const email = (await getSession(sessionId)) ?? '';
  const summary = await getAccountSummary(email);
  const [mfa, required, withStatus, params] = await Promise.all([
    getMfa(email),
    mfaRequired(email),
    // Connector add-ons belong to a site and only raise its capacity — they are not sites or licenses of their own here.
    sitesWithStatus(summary.licenses),
    searchParams,
  ]);
  const view = accountView(withStatus, summary.licenses);
  const none = view.sites.length === 0 && view.unused.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="pg-display text-4xl text-white">My sites</h1>

      {none ? (
        <div className="pg-feature p-8 text-center space-y-4">
          <h2 className="text-xl font-semibold text-white">No active license</h2>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto">
            Your account is created but you do not have an active plan yet. Choose a plan to start monitoring your UPS infrastructure.
          </p>
          <a href="/pricing" className="inline-flex px-6 py-3 rounded-full bg-[#00C66F] text-black font-medium text-sm hover:bg-[#00b564] transition">
            Upgrade now
          </a>
        </div>
      ) : (
        <SitesSection view={view} />
      )}

      <div className="space-y-1 border-t border-white/[0.06] pt-4">
        <UnusedLicenses unused={view.unused} open={params.add === '1'} />
        {/* CLOUD-MFA */}
        <TwoStepCard initial={{ enabled: !!mfa, since: mfa?.created_at ?? null, recovery_left: mfa?.recovery.length ?? 0, required }}
          extra={<a id="add-licenses" href="/pricing" className="inline-flex min-h-[44px] items-center text-sm text-white/50 hover:text-white sm:min-h-0">+ Add licenses</a>} />
      </div>
    </div>
  );
}
