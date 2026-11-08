export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { listAudit } from '@/app/lib/audit';
import { auditLine, dayLabel, nowMs } from '../model';
import type { AuditLine } from '../model';
import { CARD, Chips, Dot, PageHeader, customerHref } from '../ui';

const WHO = [
  { key: 'all', label: 'Everything' },
  { key: 'Admin', label: 'Admin' },
  { key: 'Customer', label: 'Customers' },
  { key: 'Controller', label: 'Controllers' },
] as const;

const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { who = 'all' } = await searchParams;
  const now = nowMs();
  const all = (await listAudit(200)).map(auditLine);
  const lines = all.filter((l) => who === 'all' || l.role === who);

  const days: { day: string; items: AuditLine[] }[] = [];
  for (const l of lines) {
    const d = dayLabel(l.at, now);
    if (days.at(-1)?.day !== d) days.push({ day: d, items: [] });
    days.at(-1)!.items.push(l);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" sub="Who changed what, and when: you, customers and controllers. Newest first, kept 400 days." />

      <Chips label="Who" items={WHO.map((w) => ({ key: w.key, label: w.label, count: w.key === 'all' ? all.length : all.filter((l) => l.role === w.key).length, href: w.key === 'all' ? '/admin/audit' : `/admin/audit?who=${w.key}`, on: who === w.key }))} />

      {days.length === 0 ? (
        <p className={`${CARD} px-4 py-10 text-center text-sm text-zinc-500`}>Nothing logged yet.</p>
      ) : days.map((d) => (
        <section key={d.day} aria-label={d.day}>
          <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-zinc-500">{d.day}</h2>
          <ol className={`${CARD} divide-y divide-zinc-800/70`}>
            {d.items.map((l, i) => (
              <li key={i} className="flex gap-3 px-4 py-3">
                <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-zinc-500">{time(l.at)}</span>
                <span className="pt-1.5"><Dot tone={l.tone} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-zinc-200">
                    <span className="font-medium text-white">{l.who}</span> {l.what}
                    {l.customer && l.customer !== l.who && (
                      <> for <Link href={customerHref(l.customer)} className="text-zinc-100 underline decoration-zinc-700 underline-offset-2 hover:text-[#00C66F]">{l.customer}</Link></>
                    )}
                  </p>
                  {l.detail && <p className="mt-0.5 break-words text-[13px] text-zinc-400">{l.detail}</p>}
                  <p className="mt-0.5 text-[11px] text-zinc-600">{l.role}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
