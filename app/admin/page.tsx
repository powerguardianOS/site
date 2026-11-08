export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { loadTenants } from '@/app/lib/tenants';
import { ago } from './format';
import { licenseRows, licenseCounts, needsAttention, nowMs, siteCounts } from './model';
import type { Attention } from './model';
import { BTN, BTN_PRIMARY, Dot, Kpi, PageHeader, PlanTag, Section, Status, customerHref } from './ui';
import type { Tone } from './ui';

const LEVEL: Record<Attention['level'], { tone: Tone; label: string }> = {
  critical: { tone: 'bad', label: 'Urgent' },
  warning: { tone: 'warn', label: 'Warning' },
  info: { tone: 'idle', label: 'Info' },
};

export default async function AdminOverview() {
  const now = nowMs();
  const tenants = await loadTenants();
  const rows = licenseRows(tenants, now);
  const lic = licenseCounts(rows);
  const sites = siteCounts(tenants, now);
  const attention = needsAttention(tenants, now);
  const urgent = attention.filter((a) => a.level === 'critical').length;
  const withLicense = new Set(rows.filter((r) => r.status.state === 'active' || r.status.state === 'expiring').map((r) => r.email)).size;
  const expiring = rows.filter((r) => r.status.state === 'expiring');
  const notOnline = [sites.offline && `${sites.offline} offline`, sites.never && `${sites.never} never connected`].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        sub="Customers, licenses and sites on PG Cloud."
        actions={<Link href="/admin/licenses/new" className={BTN_PRIMARY}>+ New license</Link>}
      />

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Customers" value={tenants.length} sub={`${withLicense} with an active license`} href="/admin/tenants" />
        <Kpi label="Active licenses" value={lic.active} sub={lic.expiring ? `${lic.expiring} expire within 30 days` : 'None expiring soon'} tone={lic.expiring ? 'warn' : undefined} href="/admin/licenses?status=active" />
        <Kpi label="Sites online" value={<>{sites.online}<span className="text-base font-normal text-zinc-500"> of {sites.total}</span></>} sub={notOnline || 'All checking in'} tone={notOnline ? 'warn' : 'ok'} />
        <Kpi label="Needs attention" value={attention.length} sub={urgent ? `${urgent} urgent` : attention.length ? 'Nothing urgent' : 'All clear'} tone={urgent ? 'bad' : attention.length ? undefined : 'ok'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Section title="Needs attention" className="min-w-0 lg:col-span-3" aside={<span className="text-xs text-zinc-500">{attention.length ? `${attention.length} open` : ''}</span>}>
          {attention.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">Nothing needs attention. Every site checks in and no license is about to run out.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/70">
              {attention.map((a, i) => {
                const lv = LEVEL[a.level];
                return (
                  <li key={i} className="flex gap-3 px-4 py-3.5">
                    <span className="pt-1.5" title={lv.label}><Dot tone={lv.tone} /><span className="sr-only">{lv.label}</span></span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{a.title}</p>
                        <p className="mt-0.5 text-[13px] leading-snug text-zinc-400">{a.cause}</p>
                        <p className="mt-1 truncate text-xs text-zinc-500">{a.email}{a.at ? ` · ${ago(a.at, now)}` : ''}</p>
                      </div>
                      <Link href={a.href} className={`${BTN} shrink-0 self-start whitespace-nowrap sm:self-center`}>{a.action}</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Section title="Expiring within 30 days" aside={<Link href="/admin/licenses?status=expiring" className="inline-flex h-11 items-center text-xs text-zinc-400 hover:text-white sm:h-auto">All →</Link>}>
            {expiring.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">No license runs out in the next 30 days.</p>
            ) : (
              <ul className="divide-y divide-zinc-800/70">
                {expiring.map((r) => (
                  <li key={r.id}>
                    <Link href={customerHref(r.email)} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-zinc-900/50">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-white"><span className="truncate">{r.site}</span><PlanTag plan={r.plan} /></p>
                        <p className="truncate text-xs text-zinc-500">{r.email}</p>
                      </div>
                      <Status tone={r.status.tone} className="whitespace-nowrap text-xs">{r.status.label}</Status>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Sites">
            <dl className="grid grid-cols-3 divide-x divide-zinc-800/70 text-center">
              {[
                { label: 'Online', n: sites.online, tone: 'ok' as Tone },
                { label: 'Offline', n: sites.offline, tone: (sites.offline ? 'warn' : 'idle') as Tone },
                { label: 'Never connected', n: sites.never, tone: 'idle' as Tone },
              ].map((x) => (
                <div key={x.label} className="px-2 py-4">
                  <dd className="text-xl font-semibold tabular-nums text-white">{x.n}</dd>
                  <dt className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-zinc-400"><Dot tone={x.tone} />{x.label}</dt>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
