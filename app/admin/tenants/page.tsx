export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { loadTenants } from '@/app/lib/tenants';
import type { LicenseState, Tenant } from '@/app/lib/tenants';
import { ExportButton } from '../ExportButton';
import { dateLabel } from '../format';
import { checkIn, nowMs, termStatus } from '../model';
import { BTN_PRIMARY, CARD, Chips, PageHeader, PlanTag, Status, customerHref } from '../ui';
import type { Tone } from '../ui';

const STATES: { key: 'all' | LicenseState; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
  { key: 'revoked', label: 'Revoked' },
  { key: 'none', label: 'No license' },
];

// One status per customer: the worst thing that is true right now, in plain words.
function health(t: Tenant, now: number): { tone: Tone; label: string } {
  if (!t.best) return { tone: 'idle', label: 'No license yet' };
  const term = termStatus(t.best, now);
  if (t.lowBattery) return { tone: 'bad', label: `${t.lowBattery} UPS on low battery` };
  if (t.onBattery) return { tone: 'bad', label: `${t.onBattery} UPS on battery` };
  if (term.state === 'revoked' || term.state === 'expired') return term;
  const live = t.sites.filter((s) => !s.license.expires_at || new Date(s.license.expires_at).getTime() > now);
  const off = live.filter((s) => (s.status && !s.online) || (!s.status && s.license.claimed_by));
  if (off.length) return { tone: 'warn', label: off.length === 1 ? `${off[0].license.site_name ?? 'A site'} ${checkIn([off[0]], now).label.toLowerCase()}` : `${off.length} sites offline` };
  if (term.state === 'expiring') return term;
  if (live.length && live.every((s) => !s.status && !s.license.claimed_by)) return { tone: 'idle', label: 'Never connected' };
  return { tone: 'ok', label: 'All good' };
}

function sitesLabel(t: Tenant): string {
  if (!t.sites.length) return 'No sites';
  return `${t.sitesOnline} of ${t.sites.length} site${t.sites.length === 1 ? '' : 's'} online`;
}

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = 'all', q = '' } = await searchParams;
  const now = nowMs();
  const all = await loadTenants();

  const counts = (k: string) => (k === 'all' ? all.length : all.filter((t) => t.state === k).length);
  const needle = q.trim().toLowerCase();
  const rows = all
    .filter((t) => status === 'all' || t.state === status)
    .filter((t) => !needle || t.email.includes(needle) || t.licenses.some((l) => (l.site_name ?? '').toLowerCase().includes(needle) || l.notes.toLowerCase().includes(needle)));

  const href = (key: string) => `/admin/tenants?${new URLSearchParams({ ...(key !== 'all' ? { status: key } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        sub="Every customer account with its license and live site status."
        actions={<><ExportButton /><Link href="/admin/licenses/new" className={BTN_PRIMARY}>+ New license</Link></>}
      />

      <form action="/admin/tenants" className="flex h-11 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 focus-within:border-zinc-600 sm:max-w-sm">
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-zinc-500" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <label htmlFor="tq" className="sr-only">Search customers</label>
        <input id="tq" name="q" defaultValue={q} type="search" placeholder="Search e-mail, site or note" className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-zinc-600 sm:text-sm" />
      </form>

      <Chips label="License status" items={STATES.map((s) => ({ key: s.key, label: s.label, count: counts(s.key), href: href(s.key), on: status === s.key }))} />

      {rows.length === 0 ? (
        <p className={`${CARD} px-4 py-10 text-center text-sm text-zinc-500`}>{all.length === 0 ? 'No customers yet.' : 'No customers match this filter.'}</p>
      ) : (
        <>
          {/* Phone: one card per customer */}
          <ul className={`${CARD} divide-y divide-zinc-800/70 md:hidden`}>
            {rows.map((t) => {
              const h = health(t, now);
              return (
                <li key={t.email}>
                  <Link href={customerHref(t.email)} className="flex items-center gap-3 px-4 py-3.5 active:bg-zinc-900">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex items-center gap-2"><span className="truncate text-[15px] font-medium text-white">{t.email}</span>{t.best && <PlanTag plan={t.best.plan} />}</p>
                      <Status tone={h.tone} className="text-sm">{h.label}</Status>
                      <p className="text-xs text-zinc-500">{sitesLabel(t)} · {t.devices} UPS{t.devices === 1 ? '' : 'es'}{t.best?.expires_at ? ` · until ${dateLabel(t.best.expires_at)}` : ''}</p>
                    </div>
                    <span aria-hidden="true" className="text-lg text-zinc-600">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className={`${CARD} hidden overflow-hidden md:block`}>
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <tr>
                  {['Customer', 'Status', 'Plan', 'Sites', 'UPSes', 'License term'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {rows.map((t) => {
                  const h = health(t, now);
                  return (
                    <tr key={t.email} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-3">
                        <Link href={customerHref(t.email)} className="font-medium text-white hover:text-[#00C66F]">{t.email}</Link>
                        <p className="text-xs text-zinc-500">{t.registeredAt ? `Customer since ${dateLabel(t.registeredAt)}` : 'Not registered yet'}</p>
                      </td>
                      <td className="px-4 py-3"><Status tone={h.tone}>{h.label}</Status></td>
                      <td className="px-4 py-3">{t.best ? <PlanTag plan={t.best.plan} /> : <span className="text-zinc-600">—</span>}</td>
                      <td className="px-4 py-3 text-zinc-300">{sitesLabel(t)}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-300">{t.devices || '—'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{t.best ? (t.best.expires_at ? `Until ${dateLabel(t.best.expires_at)}` : 'Never expires') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs text-zinc-500">Showing {rows.length} of {all.length} customers</p>
    </div>
  );
}
