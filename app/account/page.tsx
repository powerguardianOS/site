import { cookies } from 'next/headers';
import { getAccountSummary } from '@/app/lib/license-db';
import SitesSection, { UnusedLicenses } from './components/SitesSection';
import TwoStepCard from './components/TwoStepCard';
import { getSession } from '@/app/lib/session';
import { getMfa, mfaRequired } from '@/app/lib/mfa';
import { sitesWithStatus } from '@/app/lib/site-summary';
import { accountView } from '@/app/lib/account-view';
import { card, ghostBtn } from './components/ui';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// ACCOUNT-UI: "My sites". One card per site with its license merged in (plan badge, connectors, term), then the
// licenses no controller uses yet, then account settings. Never internal ids ('default-site') or hostnames as names.
export default async function AccountPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pg_session')?.value ?? '';
  const email = (await getSession(sessionId)) ?? '';
  const summary = await getAccountSummary(email);
  const [mfa, required, withStatus] = await Promise.all([
    getMfa(email),
    mfaRequired(email),
    // Connector add-ons belong to a site and only raise its capacity — they are not sites or licenses of their own here.
    sitesWithStatus(summary.licenses),
  ]);
  const view = accountView(withStatus, summary.licenses);
  const none = view.sites.length === 0 && view.unused.length === 0;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white" style={{ fontFamily: 'var(--pg-font-sans)' }}>My sites</h1>
        {view.chips.length > 0 && (
          <ul id="account-chips" className="flex flex-wrap gap-2" aria-label="Summary">
            {view.chips.map((c) => (
              <li key={c} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">{c}</li>
            ))}
          </ul>
        )}
      </header>

      {none && (
        <div className={`${card} p-8 text-center space-y-4`}>
          <h2 className="text-xl font-semibold text-white">No active license</h2>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto">
            Your account is created but you do not have an active plan yet. Choose a plan to start monitoring your UPS infrastructure.
          </p>
          <a href="/pricing" className="inline-flex px-6 py-3 rounded-full bg-[#00C66F] text-black font-medium text-sm hover:bg-[#00b564] transition">
            Upgrade now
          </a>
        </div>
      )}

      {view.sites.length > 0 && <SitesSection view={view} />}
      {view.sites.length === 0 && view.unused.length > 0 && (
        <p className="text-sm text-zinc-400">No controller is linked yet. Connect a controller to start monitoring your UPS.</p>
      )}

      <UnusedLicenses unused={view.unused} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Account</h2>
        {!none && (
          <div id="add-connectors" className={`${card} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <h3 className="text-base font-semibold text-white">More connectors or sites</h3>
              <p className="mt-1 text-sm text-white/50">Add connector licenses to a site, or a license for another site.</p>
            </div>
            <a href="/pricing" className={`${ghostBtn} shrink-0`}>+ Add connector licenses</a>
          </div>
        )}
        {/* CLOUD-MFA */}
        <TwoStepCard initial={{ enabled: !!mfa, since: mfa?.created_at ?? null, recovery_left: mfa?.recovery.length ?? 0, required }} />
      </section>
    </div>
  );
}
