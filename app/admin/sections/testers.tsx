import { listTesters, PROTECT_LABEL } from '@/app/lib/testers';
import { BTN, CARD, PageHeader } from '../ui';

// Beta tester sign-ups (admin only: app/admin/layout.tsx). No licence is created automatically — you decide.
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' });

export default async function TestersPage() {
  const list = await listTesters();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Testers"
        sub={`${list.length} sign-up${list.length === 1 ? '' : 's'} for the beta, newest first. No licence is made automatically: create one under Licenses when you pick someone.`}
        actions={list.length ? <a href="/api/admin/testers?format=csv" className={BTN} download>↓ Export CSV</a> : undefined}
      />
      {list.length === 0 ? (
        <p className={`${CARD} px-4 py-10 text-center text-sm text-zinc-500`}>No sign-ups yet.</p>
      ) : (
        <ol className={`${CARD} divide-y divide-zinc-800/70`} id="tester-list">
          {list.map((t) => (
            <li key={t.email} className="px-4 py-3 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-white break-all">{t.name ? `${t.name} · ` : ''}{t.email}</span>
                <span className="text-xs text-zinc-500">{day(t.created_at)}</span>
              </div>
              <p className="text-sm text-zinc-300">
                {t.ups} <span className="text-zinc-500">× {t.ups_count}</span> · {t.protects.map((p) => PROTECT_LABEL[p]).join(', ')} · {t.country}
              </p>
              {t.heard && <p className="text-[13px] text-zinc-500">Heard via: {t.heard}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
