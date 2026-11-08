export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { loadTenants, deleteBlocker, licenseState } from '@/app/lib/tenants';
import type { Site } from '@/app/lib/tenants';
import type { LicenseRecord } from '@/app/lib/license-db';
import { ago, dateLabel, runtimeLabel } from '../../format';
import { LicenseCard } from './LicenseCard';
import { DeleteTenant } from './DeleteTenant';
import { AddonList } from './AddonList';
import { DeleteSite } from './DeleteSite';
import { ControllerBlock } from './ControllerBlock';
import { isRunning } from '@/app/lib/limits';
import { BTN, CARD, PageHeader, PlanTag, Status } from '../../ui';
import { termStatus } from '../../model';

// Time checks live outside the components (they read the clock).
const inFuture = (iso: string) => new Date(iso).getTime() > Date.now();

type Tone = { label: string; text: string; dot: string; shape: string };

function power(raw: string): Tone {
  const s = raw.toUpperCase().split(/\s+/);
  if (!raw) return { label: 'No UPS data', text: 'text-zinc-500', dot: 'bg-zinc-600', shape: 'rounded-full' };
  if (s.includes('LB')) return { label: 'Low battery', text: 'text-red-300', dot: 'bg-red-400', shape: 'rounded-[2px]' };
  if (s.includes('OB')) return { label: 'On battery', text: 'text-amber-300', dot: 'bg-amber-400', shape: 'rounded-[2px]' };
  if (s.includes('RB')) return { label: 'Replace battery', text: 'text-amber-300', dot: 'bg-amber-400', shape: 'rounded-[2px]' };
  if (s.includes('OL')) return { label: 'On mains', text: 'text-green-300', dot: 'bg-green-400', shape: 'rounded-full' };
  return { label: raw, text: 'text-zinc-400', dot: 'bg-zinc-500', shape: 'rounded-full' };
}

// One card per site: the site's live state and devices, with its license (one
// license per site) underneath — they are the same thing, so they sit together.
function SiteCard({ license, site }: { license: LicenseRecord; site?: Site }) {
  const s = site?.status ?? null;
  const lic = licenseState(license);
  const worst = s?.devices.map((d) => power(d.ups_status)).find((p) => p.shape === 'rounded-[2px]');

  const state: Tone =
    lic === 'revoked' ? { label: 'License revoked', text: 'text-zinc-400', dot: 'bg-zinc-500', shape: 'rounded-none' }
    : lic === 'expired' ? { label: 'License expired', text: 'text-amber-300', dot: 'bg-amber-400', shape: 'rounded-[2px]' }
    : !s ? { label: 'Never connected', text: 'text-zinc-400', dot: 'bg-zinc-500', shape: 'rounded-full' }
    : !site?.online ? { label: 'Offline', text: 'text-zinc-400', dot: 'bg-zinc-500', shape: 'rounded-full' }
    : worst ?? { label: 'Online', text: 'text-green-300', dot: 'bg-green-400', shape: 'rounded-full' };

  return (
    <section className={`${CARD} space-y-4 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className={`h-2.5 w-2.5 shrink-0 ${state.dot} ${state.shape}`} />
            <h2 className="text-base font-semibold text-white">{license.site_name ?? s?.site_name ?? (lic === 'revoked' ? 'Former site' : 'New site')}</h2>
            <span className={`text-sm ${state.text}`}>{state.label}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {s ? `Controller ${s.controller_version || '—'} · last check-in ${ago(s.received_at)}`
              : lic === 'revoked' ? 'This site’s license is revoked, so its controller is no longer allowed.'
              : 'Waiting for the controller — link the license there (Settings → License).'}
            {' · '}created {dateLabel(license.created_at)}
            {license.minted_from && ' · founder site, added by linking a controller (follows the founder licence)'}
          </p>
        </div>
        <button type="button" disabled title="Needs a support grant from the customer (coming soon)" className="hidden h-8 cursor-not-allowed rounded-lg border border-dashed border-zinc-700 px-3 text-xs text-zinc-500 sm:inline-flex sm:items-center">
          Open console · soon
        </button>
      </div>

      {s && s.devices.length > 0 && (
        <ul className="divide-y divide-zinc-800/60 rounded-lg border border-zinc-800/70 sm:hidden">
          {s.devices.map((d, i) => {
            const p = power(d.ups_status);
            return (
              <li key={`${d.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{d.name || '—'}</p>
                  <p className="text-xs text-zinc-500">{d.ups_status ? `Battery ${Math.round(d.battery_pct)}% · load ${Math.round(d.load_pct)}% · ${runtimeLabel(d.runtime_sec)}` : 'No UPS data'}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm ${p.text}`}><span className={`h-2 w-2 ${p.dot} ${p.shape}`} />{p.label}</span>
              </li>
            );
          })}
        </ul>
      )}
      {s && s.devices.length > 0 && (
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="w-[34%] py-2 pr-4 font-medium">Device</th>
                <th className="w-[26%] py-2 pr-4 font-medium">Power</th>
                <th className="py-2 pr-4 font-medium">Battery</th>
                <th className="py-2 pr-4 font-medium">Load</th>
                <th className="py-2 font-medium">Runtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {s.devices.map((d, i) => {
                const p = power(d.ups_status);
                return (
                  <tr key={`${d.name}-${i}`}>
                    <td className="py-2.5 pr-4 font-medium text-white">{d.name || '—'}</td>
                    <td className={`py-2.5 pr-4 ${p.text}`}><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 ${p.dot} ${p.shape}`} />{p.label}</span></td>
                    <td className="py-2.5 pr-4 text-zinc-300">{d.ups_status ? `${Math.round(d.battery_pct)}%` : '—'}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">{d.ups_status ? `${Math.round(d.load_pct)}%` : '—'}</td>
                    <td className="py-2.5 text-zinc-300">{d.ups_status ? runtimeLabel(d.runtime_sec) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {s && s.devices.length === 0 && <p className="text-xs text-zinc-500">No connectors reporting on this controller yet.</p>}

      {/* Deliberately no `token` prop: the license token is never rendered anywhere. */}
      <LicenseCard
        key={`${license.id}-${license.plan}-${license.status}-${license.connector_limit}-${license.expires_at}`}
        connectorsUsed={s?.devices.length ?? 0}
        capacity={site?.limit}
        addonExtra={site?.addonExtra}
        license={{
          id: license.id, plan: license.plan, status: license.status, connector_limit: license.connector_limit,
          expires_at: license.expires_at, notes: license.notes, created_at: license.created_at,
        }}
      />

      <ControllerBlock
        licenseId={license.id}
        siteName={license.site_name ?? null}
        hostname={license.claimed_hostname ?? null}
        controllerShort={license.claimed_by ? license.claimed_by.slice(0, 8) : null}
        claimedAt={license.claimed_at ?? null}
        copies={(license.copies ?? []).map((c) => ({ hostname: c.hostname, controller_short: c.controller_id.slice(0, 8), first_seen: c.first_seen, decision: c.decision }))}
        retired={(license.retired ?? []).filter((r) => inFuture(r.until)).map((r) => ({ controller_short: (r.controller_id ?? 'legacy').slice(0, 8), until: r.until, reason: r.reason }))}
        offlineAllowed={license.offline_allowed === true}
      />

      <AddonList
        parentId={license.id}
        unlimited={license.connector_limit === 0}
        addons={(site?.addons ?? []).map((a) => ({ id: a.id, connector_limit: a.connector_limit, expires_at: a.expires_at, status: a.status, created_at: a.created_at }))}
      />

      <DeleteSite
        licenseId={license.id}
        siteName={s?.site_name ?? null}
        addonCount={site?.addons.length ?? 0}
        blocker={isRunning(license) ? 'the license is still running — revoke it or let it expire first.' : null}
      />
    </section>
  );
}

export default async function CustomerPage({ params }: { params: Promise<{ email: string }> }) {
  const email = decodeURIComponent((await params).email).toLowerCase();
  const tenant = (await loadTenants()).find((t) => t.email === email);

  if (!tenant) {
    return (
      <div className="space-y-3">
        <Link href="/admin/tenants" className="inline-flex h-11 items-center text-sm text-zinc-400 hover:text-white sm:h-auto sm:text-xs">‹ Customers</Link>
        <h1 className="break-all text-2xl font-semibold">{email}</h1>
        <p className="text-sm text-zinc-400">No account or license found for this address.</p>
        <Link href="/admin/licenses/new" className={BTN}>+ Create a license</Link>
      </div>
    );
  }

  // One license per site, oldest first. Legacy add-on records are not sites.
  const siteLicenses = tenant.licenses.filter((l) => l.plan !== 'addon_connector').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const legacyAddons = tenant.licenses.filter((l) => l.plan === 'addon_connector' && !siteLicenses.some((sl) => sl.id === l.parent_id));
  const lic = tenant.best;
  const adminAccount = !!process.env.ADMIN_EMAIL && tenant.email === process.env.ADMIN_EMAIL.toLowerCase();

  const term = lic ? termStatus(lic) : null;
  const sitesUp = tenant.sites.filter((x) => x.online).length;

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        back={{ href: '/admin/tenants', label: 'Customers' }}
        title={<span className="break-all">{tenant.email}</span>}
        sub={<>{tenant.registeredAt ? `Customer since ${dateLabel(tenant.registeredAt)}` : 'Not registered yet'} · {siteLicenses.length} site{siteLicenses.length === 1 ? '' : 's'}{tenant.sites.length ? `, ${sitesUp} online` : ''}</>}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {lic && <PlanTag plan={lic.plan} />}
        {term ? <Status tone={term.tone}>{`License: ${term.label.charAt(0).toLowerCase()}${term.label.slice(1)}`}</Status> : <Status tone="idle">No license yet</Status>}
        {tenant.onBattery + tenant.lowBattery > 0 && <Status tone="bad">{tenant.onBattery + tenant.lowBattery} UPS on battery</Status>}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <h2 className="text-sm font-semibold text-zinc-300">Sites</h2>
        <Link href={`/admin/licenses/new?email=${encodeURIComponent(tenant.email)}`} className={BTN}>
          + Add site
        </Link>
      </div>

      <div className="space-y-4">
        {siteLicenses.length === 0 && (
          <p className="rounded-xl border border-zinc-800 p-6 text-center text-sm text-zinc-500">No sites yet. Add a site to create this customer&apos;s first license.</p>
        )}
        {siteLicenses.map((l) => (
          <SiteCard key={l.id} license={l} site={tenant.allSites.find((s) => s.license.id === l.id)} />
        ))}
      </div>

      {legacyAddons.length > 0 && (
        <section className="space-y-3 rounded-xl border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-300">Legacy add-on licenses</h2>
          <p className="text-xs text-zinc-500">These add-on records are not attached to a site, so the license check ignores them. Add the connectors again from the site they belong to, then delete these.</p>
          {legacyAddons.map((l) => (
            <LicenseCard key={l.id} license={{ id: l.id, plan: l.plan, status: l.status, connector_limit: l.connector_limit, expires_at: l.expires_at, notes: l.notes, created_at: l.created_at }} />
          ))}
        </section>
      )}

      <div className="grid items-stretch gap-4 md:grid-cols-2">
        <section className={`${CARD} space-y-3 p-5`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Support access</h2>
            <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">Customer-controlled</span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">
            Only the customer can grant access, from Settings → Security on their controller. It is time-limited and every action is logged. The grant status will show here once controllers report it.
          </p>
        </section>

        <DeleteTenant
          email={tenant.email}
          licenseCount={tenant.licenses.length}
          blocker={deleteBlocker(tenant)}
          isAdminAccount={adminAccount}
        />
      </div>
    </div>
  );
}
