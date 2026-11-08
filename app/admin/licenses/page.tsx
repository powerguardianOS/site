export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { loadTenants } from '@/app/lib/tenants';
import { licenseRows, licenseCounts, nowMs } from '../model';
import type { LicenseRow } from '../model';
import { BTN_PRIMARY, CARD, Chips, PageHeader, PlanTag, Status, customerHref } from '../ui';
import { RevokeButton } from './RevokeButton';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
  { key: 'revoked', label: 'Revoked' },
] as const;

const controllers = (r: LicenseRow) => `${r.controllers.used} / ${r.controllers.limit === null ? '∞' : r.controllers.limit}`;
const connectors = (r: LicenseRow) => `${r.connectors.used} / ${r.connectors.limit === 0 ? '∞' : r.connectors.limit}`;

function Founder({ r }: { r: LicenseRow }) {
  if (!r.foundersites.length) return null;
  return <p className="mt-0.5 truncate text-xs text-zinc-500">+ {r.foundersites.length} founder site{r.foundersites.length === 1 ? '' : 's'}: {r.foundersites.join(', ')}</p>;
}

export default async function LicensesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'all' } = await searchParams;
  const now = nowMs();
  const all = licenseRows(await loadTenants(), now);
  const counts = licenseCounts(all);
  const rows = all.filter((r) =>
    status === 'all' ? true : status === 'active' ? r.status.state === 'active' || r.status.state === 'expiring' : r.status.state === status);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Licenses"
        sub="One license per site. Founder licenses carry any number of founder sites. Licenses for controllers come only from here."
        actions={<Link href="/admin/licenses/new" className={BTN_PRIMARY}>+ New license</Link>}
      />

      <Chips label="License status" items={FILTERS.map((f) => ({ key: f.key, label: f.label, count: counts[f.key], href: f.key === 'all' ? '/admin/licenses' : `/admin/licenses?status=${f.key}`, on: status === f.key }))} />

      {rows.length === 0 ? (
        <p className={`${CARD} px-4 py-10 text-center text-sm text-zinc-500`}>{all.length ? 'No license matches this filter.' : 'No licenses yet.'}</p>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className={`${CARD} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold text-white">{r.site}</span><PlanTag plan={r.plan} /></p>
                    <Link href={customerHref(r.email)} className="-my-2 block truncate py-2 text-sm text-zinc-400 underline-offset-2 hover:underline">{r.email}</Link>
                  </div>
                  <Status tone={r.status.tone} className="shrink-0 pt-0.5 text-sm">{r.status.label}</Status>
                </div>
                <Founder r={r} />
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-zinc-800/70 pt-3 text-sm">
                  <div><dt className="text-xs text-zinc-500">Controllers</dt><dd className="tabular-nums text-zinc-100">{controllers(r)}</dd></div>
                  <div><dt className="text-xs text-zinc-500">Connectors</dt><dd className="tabular-nums text-zinc-100">{connectors(r)}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-zinc-500">Last check-in</dt><dd><Status tone={r.check.tone}>{r.check.label}</Status><p className="text-xs text-zinc-500">{r.check.detail}</p></dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/70 pt-3">
                  <span className="text-sm text-zinc-300">{r.term}</span>
                  <RevokeButton id={r.id} site={r.site} email={r.email} revoked={r.revoked} founderSites={r.followers} />
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className={`${CARD} hidden md:block`}>
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Site · customer</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Controllers</th>
                  <th className="px-4 py-2.5 font-medium">Connectors</th>
                  <th className="px-4 py-2.5 font-medium">Last check-in</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 align-top">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-900/40">
                    <td className="max-w-[280px] px-4 py-3">
                      <p className="flex items-center gap-2"><span className="truncate font-medium text-white">{r.site}</span><PlanTag plan={r.plan} /></p>
                      <Link href={customerHref(r.email)} className="block truncate text-xs text-zinc-400 hover:text-[#00C66F]">{r.email}</Link>
                      <Founder r={r} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3"><Status tone={r.status.tone}>{r.status.label}</Status><p className="text-xs text-zinc-500">{r.term}</p></td>
                    <td className="px-4 py-3 tabular-nums text-zinc-200">{controllers(r)}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-200">{connectors(r)}</td>
                    <td className="px-4 py-3">
                      <Status tone={r.check.tone} className="whitespace-nowrap">{r.check.label}</Status>
                      <p className="text-xs text-zinc-500">{r.check.detail}</p>
                    </td>
                    <td className="w-[1%] px-4 py-2.5 text-right">
                      <div className="flex min-w-[110px] justify-end">
                        <RevokeButton id={r.id} site={r.site} email={r.email} revoked={r.revoked} founderSites={r.followers} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs text-zinc-500">Showing {rows.length} of {all.length} licenses · connector add-ons count toward their site&apos;s limit.</p>
    </div>
  );
}
