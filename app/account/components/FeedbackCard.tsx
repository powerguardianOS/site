'use client';

// FEEDBACK-1: one form, two kinds (Problem = bug, Idea = idea), then "Your reports" with status and replies. Used on
// /account (closed: one card with Send feedback) and /feedback (open). Everything inline: no modal, toast or alert().
// Text from customers and replies is rendered by React as text, never as HTML.
import { useEffect, useState } from 'react';
import type { FbStatus, Kind, OwnItem } from '@/app/lib/feedback';
import { shortDate } from '@/app/admin/format';
import { ghostBtn } from './ui';

const STATUS: Record<FbStatus, string> = { new: 'New', seen: 'Seen', planned: 'Planned', fixed: 'Fixed', rejected: 'Not planned' };
const PILL = 'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px]';
const TONE: Record<FbStatus, string> = {
  new: 'border-white/10 bg-white/[0.04] text-white/60',
  seen: 'border-white/10 bg-white/[0.04] text-white/60',
  planned: 'border-transparent bg-amber-400/10 text-amber-300',
  fixed: 'border-transparent bg-[#00C66F]/10 text-[#00C66F]',
  rejected: 'border-white/10 bg-white/[0.04] text-white/40',
};

function day(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toDateString() === new Date().toDateString() ? 'today' : shortDate(d, false);
}

const ERRORS: Record<string, string> = {
  rate_limited: 'That is the limit for today. Try again tomorrow.',
  too_large: 'That is too long. Keep it shorter.',
  unauthorized: 'You are signed out. Sign in again.',
};

export default function FeedbackCard({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [kind, setKind] = useState<Kind>('bug');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [items, setItems] = useState<OwnItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/account/feedback', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setItems(((await r.json()) as { items: OwnItem[] }).items);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };
  useEffect(() => { load(); }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) { setError('Write a few words first.'); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/account/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, text }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) { setError(d.message ?? ERRORS[d.error ?? ''] ?? 'Could not send it. Try again.'); return; }
      setText(''); setSent(true);
      await load();
    } catch {
      setError('No connection. Try again.'); // the text stays in the box
    } finally {
      setBusy(false);
    }
  };

  const seg = (k: Kind, label: string) => (
    <button type="button" id={`fb-kind-${k}`} role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setError(''); }}
      className={`min-h-[44px] flex-1 px-3 text-sm sm:min-h-[36px] ${kind === k ? 'bg-white/[0.08] font-semibold text-white' : 'text-white/50 hover:text-white/80'}`}>
      {label}
    </button>
  );

  return (
    <section id="feedback" className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 text-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-white">{open && !sent ? 'Send feedback' : 'Feedback'}</h2>
          {!open && <p className="text-white/50">Found a problem or have an idea? Tell us.</p>}
        </div>
        {!open && <button id="fb-open" className={ghostBtn} onClick={() => setOpen(true)}>Send feedback</button>}
      </div>

      {open && (sent ? (
        <div id="fb-done" className="space-y-1">
          <p className="font-medium text-white">Thanks, we got it</p>
          <p className="text-white/50">We&apos;ll reply here, under Your reports.</p>
          <button id="fb-again" className="inline-flex min-h-[44px] items-center text-[#00C66F] hover:underline sm:min-h-0" onClick={() => setSent(false)}>Send another</button>
        </div>
      ) : (
        <form id="fb-form" onSubmit={send} className="space-y-3">
          <div role="radiogroup" aria-label="Kind" className="flex overflow-hidden rounded-lg border border-white/10">
            {seg('bug', 'Problem')}{seg('idea', 'Idea')}
          </div>
          <label className="block space-y-1.5">
            <span className="text-white/70">{kind === 'bug' ? 'What happened?' : 'What would help you?'}</span>
            <textarea id="fb-text" value={text} maxLength={4000} rows={4} onChange={(e) => { setText(e.target.value); setError(''); }}
              className="block w-full resize-y rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-base text-white outline-none focus:border-[#00C66F] sm:text-sm" />
          </label>
          {error && <p id="fb-error" className="text-red-400">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/40">Replies show up under Your reports.</p>
            <button id="fb-send" type="submit" disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-[#00C66F] px-5 text-sm font-medium text-black hover:bg-[#00b564] disabled:opacity-50 sm:min-h-[36px]">
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      ))}

      {loadError && <p className="text-xs text-white/40">Could not load your reports right now.</p>}
      {items && items.length > 0 && (
        <div className="space-y-1 border-t border-white/[0.06] pt-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">Your reports</h3>
          <ul id="fb-reports" className="divide-y divide-white/[0.06]">
            {items.map((it) => (
              <li key={it.id} className="fb-item space-y-1.5 py-3" data-id={it.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="fb-text min-w-0 whitespace-pre-line break-words text-white">{it.text}</p>
                  <span className={`fb-status ${PILL} ${TONE[it.status]}`}>
                    {it.status === 'fixed' && it.fixed_in ? `Fixed in ${it.fixed_in}` : STATUS[it.status]}
                  </span>
                </div>
                <p className="text-xs text-white/40">
                  {it.kind === 'bug' ? 'Problem' : 'Idea'} · {day(it.created_at)}
                  {it.replies.length > 0 && ` · ${it.replies.length} ${it.replies.length === 1 ? 'reply' : 'replies'}`}
                </p>
                {it.replies.map((r, i) => (
                  <div key={i} className="fb-reply rounded-lg border-l-2 border-[#00C66F]/50 bg-white/[0.03] px-3 py-2">
                    <p className="whitespace-pre-line break-words text-white/80">{r.text}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">PowerGuardian · {day(r.at)}</p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
