export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { loadTenants, attentionItems } from '@/app/lib/tenants';
import { ago, dateLabel } from './format';

const TONE = {
  critical: { dot: 'bg-red-400', text: 'text-red-300', label: 'Critical', shape: 'rounded-[2px]' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'Warning', shape: 'rounded-full' },
  info: { dot: 'bg-zinc-500', text: 'text-zinc-400', label: 'Info', shape: 'rounded-full' },
} as const;

export default async function AdminOverview() {
  const tenants = await loadTenants();
  const attention = attentionItems(tenants);

  const sites = tenants.flatMap((t) => t.sites);
  const sitesOnline = sites.filter((s) => s.online).length;
  const activeLicenses = tenants.flatMap((t) => t.licenses).filter((l) => l.status === 'active').length;
  const expiring = tenants.filter((t) => t.state === 'expiring');
  const onBattery = tenants.reduce((n, t) => n + t.onBattery + t.lowBattery, 0);

  const kpis = [
    { label: 'Tenants', value: String(tenants.length), sub: `${tenants.filter((t) => t.state !== 'none').length} with a license` },
    { label: 'Active licenses', value: String(activeLicenses), sub: expiring.length ? `${expiring.length} expiring in 30 days` : 'none expiring soon', warn: expiring.length > 0 },
    { label: 'Sites online', value: `${sitesOnline} / ${sites.length}`, sub: sites.length - sitesOnline ? `${sites.length - sitesOnline} not reporting` : 'all reporting', warn: sites.length - sitesOnline > 0 },
    { label: 'Devices on battery', value: String(onBattery), sub: onBattery ? 'needs attention' : 'all on mains', warn: onBattery > 0 },
    { label: 'Open attention items', value: String(attention.length), sub: `${attention.filter((a) => a.level === 'critical').length} critical`, warn: attention.some((a) => a.level === 'critical') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-zinc-400">Health of every tenant and site on the platform.</p>
        </div>
        <Link href="/admin/licenses/new" className="rounded-lg bg-[#00C66F] px-3 py-1.5 text-xs font-medium text-black hover:bg-[#00b564]">
          + New license
        </Link>
      </div>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <p className="text-xs text-zinc-500">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold">{k.value}</p>
            <p className={`text-xs ${k.warn ? 'text-amber-400' : 'text-zinc-500'}`}>{k.sub}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Needs attention</h2>
            <Link href="/admin/tenants" className="text-xs text-zinc-400 hover:text-white">All tenants →</Link>
          </div>
          {attention.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Nothing needs attention. All sites are reporting and no license is about to expire.</p>
          ) : attention.map((a, i) => {
            const t = TONE[a.level];
            return (
              <div key={i} className="flex flex-wrap items-center gap-3 border-t border-zinc-800/60 py-3">
                <div className={`flex w-20 items-center gap-1.5 text-xs font-semibold ${t.text}`}>
                  <span className={`h-2 w-2 ${t.dot} ${t.shape}`} />{t.label}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/customers/${encodeURIComponent(a.email)}`} className="font-medium text-white hover:text-[#00C66F]">{a.email}</Link>
                  <p className="text-sm text-zinc-400">{a.text}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-zinc-500">{a.at ? ago(a.at) : ''}</span>
                <Link href={`/admin/customers/${encodeURIComponent(a.email)}`} className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-900">Open</Link>
              </div>
            );
          })}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Licenses expiring in 30 days</h2>
          {expiring.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">None.</p>
          ) : expiring.map((t) => (
            <div key={t.email} className="flex items-center gap-3 border-t border-zinc-800/60 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/customers/${encodeURIComponent(t.email)}`} className="font-medium text-white hover:text-[#00C66F]">{t.email}</Link>
                <p className="text-xs uppercase text-zinc-500">{t.best?.plan}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-amber-300">{dateLabel(t.best!.expires_at)}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
