export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { loadTenants } from '@/app/lib/tenants';
import type { LicenseState, Tenant } from '@/app/lib/tenants';
import { ExportButton } from '../ExportButton';
import { ago, dateLabel } from '../format';

const STATES: { key: 'all' | LicenseState; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
  { key: 'revoked', label: 'Revoked' },
  { key: 'none', label: 'No license' },
];

const LIC_TONE: Record<LicenseState, { dot: string; text: string; shape: string; label: string }> = {
  active: { dot: 'bg-green-400', text: 'text-green-300', shape: 'rounded-full', label: 'Active' },
  expiring: { dot: 'bg-amber-400', text: 'text-amber-300', shape: 'rounded-[2px]', label: 'Expiring' },
  expired: { dot: 'bg-amber-400', text: 'text-amber-300', shape: 'rounded-[2px]', label: 'Expired' },
  revoked: { dot: 'bg-zinc-500', text: 'text-zinc-400', shape: 'rounded-none', label: 'Revoked' },
  none: { dot: 'bg-zinc-600', text: 'text-zinc-500', shape: 'rounded-full', label: 'No license' },
};

function siteCell(t: Tenant) {
  if (t.sites.length === 0) return { label: '—', tone: 'text-zinc-600', dot: 'bg-zinc-700' };
  if (t.onBattery + t.lowBattery > 0) return { label: `${t.sitesOnline}/${t.sites.length} · on battery`, tone: 'text-amber-300', dot: 'bg-amber-400' };
  if (t.sitesOnline === t.sites.length) return { label: `${t.sitesOnline}/${t.sites.length} online`, tone: 'text-green-300', dot: 'bg-green-400' };
  if (t.sitesOnline === 0 && t.lastBeat === null) return { label: 'Not connected', tone: 'text-zinc-400', dot: 'bg-zinc-500' };
  return { label: `${t.sitesOnline}/${t.sites.length} online`, tone: 'text-zinc-300', dot: 'bg-zinc-500' };
}

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = 'all', q = '' } = await searchParams;
  const all = await loadTenants();

  const counts = (k: string) => (k === 'all' ? all.length : all.filter((t) => t.state === k).length);
  const needle = q.trim().toLowerCase();
  const rows = all
    .filter((t) => status === 'all' || t.state === status)
    .filter((t) => !needle || t.email.includes(needle) || (t.best?.notes ?? '').toLowerCase().includes(needle));

  const href = (key: string) => `/admin/tenants?${new URLSearchParams({ ...(key !== 'all' ? { status: key } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-sm text-zinc-400">Every customer account with its license and live site status.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
          <Link href="/admin/licenses/new" className="rounded-lg bg-[#00C66F] px-3 py-1.5 text-xs font-medium text-black hover:bg-[#00b564]">+ New license</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action="/admin/tenants" className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3">
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <label htmlFor="tq" className="sr-only">Filter tenants</label>
          <input id="tq" name="q" defaultValue={q} type="search" placeholder="Filter by e-mail or note" className="w-64 bg-transparent py-2 text-sm text-white outline-none placeholder:text-zinc-600" />
        </form>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="License status">
          {STATES.map((s) => {
            const on = status === s.key;
            return (
              <Link key={s.key} href={href(s.key)} aria-current={on ? 'true' : undefined}
                className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-[#2f5a43] bg-[#17201b] text-[#00C66F]' : 'border-zinc-800 text-zinc-300 hover:bg-zinc-900'}`}>
                {s.label} <span className="opacity-60">{counts(s.key)}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950/50 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              {['Tenant', 'Plan', 'License', 'Sites', 'Devices', 'Last heartbeat', 'Expires'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">{all.length === 0 ? 'No tenants yet.' : 'No tenants match this filter.'}</td></tr>
            ) : rows.map((t) => {
              const lic = LIC_TONE[t.state];
              const site = siteCell(t);
              const hot = t.onBattery + t.lowBattery > 0;
              return (
                <tr key={t.email} className={`hover:bg-zinc-900/40 ${hot ? 'bg-amber-950/10' : ''}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${encodeURIComponent(t.email)}`} className="font-medium text-white hover:text-[#00C66F]">{t.email}</Link>
                    <p className="text-xs text-zinc-500">{t.registeredAt ? `Registered ${dateLabel(t.registeredAt)}` : 'Not registered yet'}</p>
                  </td>
                  <td className="px-4 py-3">{t.best ? <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs uppercase text-zinc-300">{t.best.plan}</span> : <span className="text-zinc-600">—</span>}</td>
                  <td className={`px-4 py-3 ${lic.text}`}><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 ${lic.dot} ${lic.shape}`} />{lic.label}</span></td>
                  <td className={`px-4 py-3 ${site.tone}`}><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${site.dot}`} />{site.label}</span></td>
                  <td className="px-4 py-3 text-zinc-300">{t.devices || '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{t.sites.length ? ago(t.lastBeat) : '—'}</td>
                  <td className={`px-4 py-3 text-xs ${t.state === 'expiring' || t.state === 'expired' ? 'text-amber-300' : 'text-zinc-400'}`}>{t.best ? dateLabel(t.best.expires_at) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Showing {rows.length} of {all.length} tenants</p>
    </div>
  );
}
