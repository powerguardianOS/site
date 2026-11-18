'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminRow, FbStatus } from '@/app/lib/feedback';
import { shortDate } from '../format';
import { BTN, BTN_DANGER, BTN_PRIMARY, Status } from '../ui';
import type { Tone } from '../ui';

// One feedback item in /admin/feedback with its inline actions: Reply, Merge into…, Plan, Fixed in [version], Reject,
// Mark seen. A panel opens in the row itself (no modal); the page reloads its data after a change.
const LABEL: Record<FbStatus, [string, Tone]> = {
  new: ['New', 'warn'], seen: ['Seen', 'idle'], planned: ['Planned', 'ok'], fixed: ['Fixed', 'ok'], rejected: ['Rejected', 'off'],
};
const FIELD = 'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-white outline-none focus:border-[#00C66F] sm:text-sm';

export function FeedbackRow({ row, targets }: { row: AdminRow; targets: { id: string; text: string }[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<'' | 'reply' | 'merge' | 'fixed'>('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(body: Record<string, string>) {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, ...body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setPanel(''); setValue('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }
  const toggle = (p: typeof panel, initial = '') => { setPanel(panel === p ? '' : p); setValue(initial); setError(''); };
  const [label, tone] = LABEL[row.status];

  return (
    <li className="feedback-row space-y-2 px-4 py-3" data-id={row.id}>
      <div className="flex items-start justify-between gap-3">
        <p className="feedback-text min-w-0 whitespace-pre-line break-words text-sm text-white">{row.text}</p>
        <Status tone={tone} className="feedback-status shrink-0 text-xs">{row.status === 'fixed' && row.fixed_in ? `Fixed in ${row.fixed_in}` : label}</Status>
      </div>
      <p className="feedback-meta text-xs text-zinc-500">
        <span className="feedback-count font-medium text-zinc-300">{row.count}×</span>
        {' · '}{row.customers} customer{row.customers === 1 ? '' : 's'}
        {row.versions.length > 0 && ` · ${row.versions.join(', ')}`}
        {row.reports.length > 0 && <> · <span className="feedback-reports break-all">report {row.reports.join(', ')}</span></>}
        {' · '}{shortDate(row.created_at * 1000)}
      </p>
      {row.replies.map((r, i) => (
        <p key={i} className="feedback-reply whitespace-pre-line break-words border-l-2 border-[#2f5a43] pl-3 text-[13px] text-zinc-300">
          {r.text} <span className="text-xs text-zinc-500">· {shortDate(r.at * 1000)}</span>
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`fb-act-reply ${BTN}`} aria-expanded={panel === 'reply'} onClick={() => toggle('reply')}>Reply</button>
        {targets.length > 0 && <button type="button" className={`fb-act-merge ${BTN}`} aria-expanded={panel === 'merge'} onClick={() => toggle('merge', targets[0].id)}>Merge into…</button>}
        {row.status === 'new' && <button type="button" className={`fb-act-seen ${BTN}`} disabled={busy} onClick={() => act({ action: 'seen' })}>Mark seen</button>}
        {row.status !== 'planned' && <button type="button" className={`fb-act-plan ${BTN}`} disabled={busy} onClick={() => act({ action: 'plan' })}>Plan</button>}
        <button type="button" className={`fb-act-fixed ${BTN}`} aria-expanded={panel === 'fixed'} onClick={() => toggle('fixed', row.fixed_in ?? '')}>Fixed in…</button>
        {row.status !== 'rejected' && <button type="button" className={`fb-act-reject ${BTN_DANGER}`} disabled={busy} onClick={() => act({ action: 'reject' })}>Reject</button>}
      </div>
      {panel === 'reply' && (
        <form className="fb-panel space-y-2" onSubmit={(e) => { e.preventDefault(); act({ action: 'reply', text: value }); }}>
          <textarea className={`fb-reply-text ${FIELD}`} rows={3} maxLength={4000} value={value} onChange={(e) => setValue(e.target.value)}
            aria-label="Reply" placeholder={`Visible to ${row.customers === 1 ? 'the reporter' : `all ${row.customers} reporters`}`} />
          <button type="submit" className={`fb-reply-send ${BTN_PRIMARY}`} disabled={busy || !value.trim()}>{busy ? 'Sending…' : 'Send reply'}</button>
        </form>
      )}
      {panel === 'merge' && (
        <form className="fb-panel flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); act({ action: 'merge', into: value }); }}>
          <select className={`fb-merge-into ${FIELD} sm:w-auto sm:max-w-md`} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Merge into">
            {targets.map((t) => <option key={t.id} value={t.id}>{t.text}</option>)}
          </select>
          <button type="submit" className={`fb-merge-go ${BTN_PRIMARY}`} disabled={busy}>{busy ? 'Merging…' : 'Merge'}</button>
        </form>
      )}
      {panel === 'fixed' && (
        <form className="fb-panel flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); act({ action: 'fixed', fixed_in: value }); }}>
          <input className={`fb-fixed-version ${FIELD} sm:w-40`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.1.121" aria-label="Fixed in version" maxLength={32} />
          <button type="submit" className={`fb-fixed-go ${BTN_PRIMARY}`} disabled={busy}>{busy ? 'Saving…' : 'Mark fixed'}</button>
        </form>
      )}
      {error && <p className="fb-error text-xs text-red-400">{error}</p>}
    </li>
  );
}
