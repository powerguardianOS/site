export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { loadTenants, deleteBlocker } from '@/app/lib/tenants';
import type { Site } from '@/app/lib/tenants';
import { ago, dateLabel, runtimeLabel } from '../../format';
import { LicenseCard } from './LicenseCard';
import { DeleteTenant } from './DeleteTenant';

function power(raw: string): { label: string; text: string; dot: string; shape: string } {
  const s = raw.toUpperCase().split(/\s+/);
  if (!raw) return { label: 'No UPS data', text: 'text-zinc-500', dot: 'bg-zinc-600', shape: 'rounded-full' };
  if (s.includes('LB')) return { label: 'Low battery', text: 'text-red-300', dot: 'bg-red-400', shape: 'rounded-[2px]' };
  if (s.includes('OB')) return { label: 'On battery', text: 'text-amber-300', dot: 'bg-amber-400', shape: 'rounded-[2px]' };
  if (s.includes('RB')) return { label: 'Replace battery', text: 'text-amber-300', dot: 'bg-amber-400', shape: 'rounded-[2px]' };
  if (s.includes('OL')) return { label: 'On mains', text: 'text-green-300', dot: 'bg-green-400', shape: 'rounded-full' };
  return { label: raw, text: 'text-zinc-400', dot: 'bg-zinc-500', shape: 'rounded-full' };
}

function SiteCard({ site }: { site: Site }) {
  const s = site.status;
  const worst = s?.devices.map((d) => power(d.ups_status)).find((p) => p.shape === 'rounded-[2px]');
  const state = !s ? { label: 'Never connected', text: 'text-zinc-400', dot: 'bg-zinc-500', shape: 'rounded-full' }
    : !site.online ? { label: 'Offline', text: 'text-zinc-400', dot: 'bg-zinc-500', shape: 'rounded-full' }
    : worst ? { label: worst.label, text: worst.text, dot: worst.dot, shape: worst.shape }
    : { label: 'Online', text: 'text-green-300', dot: 'bg-green-400', shape: 'rounded-full' };

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 ${state.dot} ${state.shape}`} />
            <h2 className="text-base font-semibold">{s?.site_name ?? 'Waiting for first connection'}</h2>
            <span className={`text-sm ${state.text}`}>{state.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {s ? `Controller ${s.controller_version || '—'} · heartbeat ${ago(s.received_at)}` : 'Link the license on the controller (Settings → License).'}
          </p>
        </div>
        <button type="button" disabled className="cursor-not-allowed rounded-lg border border-dashed border-zinc-700 px-3 py-1.5 text-xs text-zinc-500">
          Open console · needs a support grant (soon)
        </button>
      </div>

      {s && s.devices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>{['Device', 'Power', 'Battery', 'Load', 'Runtime'].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr>
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
                    <td className="py-2.5 pr-4 text-zinc-300">{d.ups_status ? runtimeLabel(d.runtime_sec) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {s && s.devices.length === 0 && <p className="text-xs text-zinc-500">No devices adopted on this controller yet.</p>}
    </section>
  );
}

export default async function CustomerPage({ params }: { params: Promise<{ email: string }> }) {
  const email = decodeURIComponent((await params).email).toLowerCase();
  const tenant = (await loadTenants()).find((t) => t.email === email);

  if (!tenant) {
    return (
      <div className="space-y-3">
        <Link href="/admin/tenants" className="text-xs text-zinc-500 hover:text-zinc-300">← Tenants</Link>
        <h1 className="break-all text-2xl font-semibold">{email}</h1>
        <p className="text-sm text-zinc-400">No account or license found for this address.</p>
        <Link href="/admin/licenses/new" className="inline-block rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900">+ Create a license</Link>
      </div>
    );
  }

  const lic = tenant.best;
  const badge = { active: 'text-green-300', expiring: 'text-amber-300', expired: 'text-amber-300', revoked: 'text-zinc-400', none: 'text-zinc-500' }[tenant.state];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/tenants" className="text-xs text-zinc-500 hover:text-zinc-300">← Tenants</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="break-all text-2xl font-semibold">{tenant.email}</h1>
          {lic && <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs uppercase text-zinc-300">{lic.plan}</span>}
          <span className={`text-sm capitalize ${badge}`}>{tenant.state === 'none' ? 'No license' : `License ${tenant.state}`}</span>
          {tenant.onBattery + tenant.lowBattery > 0 && <span className="text-sm text-amber-300">{tenant.onBattery + tenant.lowBattery} device on battery</span>}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {tenant.registeredAt ? `Registered ${dateLabel(tenant.registeredAt)}` : 'Not registered yet'} · {tenant.licenses.length} license{tenant.licenses.length === 1 ? '' : 's'} · {tenant.sites.length} site{tenant.sites.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <h2 className="text-sm font-semibold text-zinc-300">Sites</h2>
          {tenant.sites.length === 0
            ? <p className="rounded-xl border border-zinc-800 p-6 text-center text-sm text-zinc-500">No site yet: this tenant has no active license.</p>
            : tenant.sites.map((s) => <SiteCard key={s.license.id} site={s} />)}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-300">Licenses <span className="font-normal text-zinc-500">· one per site</span></h2>
          {tenant.licenses.length === 0 && <p className="rounded-xl border border-zinc-800 p-6 text-center text-sm text-zinc-500">No licenses for this tenant.</p>}
          {tenant.licenses.map((l) => (
            // Deliberately no `token` prop: the license token is never rendered anywhere.
            <LicenseCard key={`${l.id}-${l.plan}-${l.status}-${l.connector_limit}-${l.expires_at}`} siteLabel={tenant.sites.find((s) => s.license.id === l.id)?.status?.site_name ?? (l.status === 'revoked' ? 'Revoked' : 'Not connected yet')} license={{
              id: l.id, plan: l.plan, status: l.status, connector_limit: l.connector_limit,
              expires_at: l.expires_at, notes: l.notes, created_at: l.created_at,
            }} />
          ))}
          <Link href={`/admin/licenses/new?email=${encodeURIComponent(tenant.email)}`} className="inline-block rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900">+ Add site</Link>

          <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Support access</h2>
              <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">Customer-controlled</span>
            </div>
            <p className="text-xs text-zinc-400">
              Only the customer can grant access, from Settings → Security on their controller. It is time-limited and every action is logged. The grant status will show here once controllers report it.
            </p>
          </section>

          <DeleteTenant
            email={tenant.email}
            licenseCount={tenant.licenses.length}
            blocker={deleteBlocker(tenant)}
            isAdminAccount={!!process.env.ADMIN_EMAIL && tenant.email === process.env.ADMIN_EMAIL.toLowerCase()}
          />
        </div>
      </div>
    </div>
  );
}
