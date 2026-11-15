'use client';

// SESSIONS-1: "Sign-in & security". One quiet line on the account page ("Sign-in & security · 2 active sessions");
// it opens inline: the signed-in browsers (this one first, each with Sign out), Sign out all other devices, and the
// account's recent activity. Confirmations are inline, never a modal.
import { useState } from 'react';
import type { SessionRow, ActivityRow } from '@/app/lib/security-view';
import { ghostBtn } from './ui';

type Data = { sessions: SessionRow[]; activity: ActivityRow[] };

async function post(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const r = await fetch('/api/account/security', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: 'No connection. Try again.' } };
  }
}

function ago(ms: number | null, now: number): string {
  if (!ms) return '';
  const m = Math.round((now - ms) / 60_000);
  if (m < 5) return 'Active now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
}
const when = (ms: number | string | null) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const sessionsText = (n: number) => `${n} active ${n === 1 ? 'session' : 'sessions'}`;

export default function SecurityCard({ count: initialCount }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null); // a ref, or 'others'
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = async () => {
    setError('');
    try {
      const r = await fetch('/api/account/security', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const d = (await r.json()) as Data;
      setData(d); setCount(d.sessions.length); setNow(Date.now());
    } catch {
      setError('Could not load this right now. Try again.');
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next); setConfirm(null); setAll(false);
    if (next) await load();
  };

  const revoke = async (body: { action: 'revoke'; ref: string } | { action: 'revoke_others' }) => {
    setBusy(true); setError('');
    const r = await post(body);
    setBusy(false); setConfirm(null);
    if (!r.ok && r.data.error !== 'not_found') { setError(String(r.data.message ?? 'Something went wrong. Try again.')); return; }
    await load();
  };

  const others = data ? data.sessions.filter((s) => !s.current) : [];
  const shown = data ? (all ? data.activity : data.activity.slice(0, 8)) : [];

  return (
    <section id="security" className="text-sm">
      <p className="text-white/50">
        Sign-in &amp; security · <span id="security-count" className="text-white/70">{sessionsText(count)}</span>{' · '}
        <button id="security-manage" aria-expanded={open} onClick={toggle}
          className="inline-flex min-h-[44px] items-center text-[#00C66F] hover:underline sm:min-h-0">
          {open ? 'Close' : 'Manage'}
        </button>
      </p>

      {open && (
        <div className="mt-2 space-y-5 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5">
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          {!data && !error && <p className="text-white/50">Loading…</p>}

          {data && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">Signed in</h3>
              <ul id="security-sessions" className="divide-y divide-white/[0.06]">
                {data.sessions.map((s) => (
                  <li key={s.ref} className="session-row py-3 first:pt-1" data-ref={s.ref} data-current={s.current ? '1' : undefined}>
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-2 text-white">
                          <span className="session-device font-medium">{s.device}{s.browser ? ` · ${s.browser}` : ''}</span>
                          {s.current && (
                            <span className="session-this inline-flex items-center rounded-md border border-[#00C66F]/40 bg-[#00C66F]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00C66F]">This device</span>
                          )}
                        </p>
                        <p className="session-where text-xs text-white/50">{[s.place || 'Place unknown', s.ip].filter(Boolean).join(' · ')}</p>
                        <p className="session-meta text-xs text-white/40">
                          {s.current ? 'Active now' : ago(s.seen, now)}{s.created ? ` · signed in ${when(s.created)}` : ''} · {s.method}
                        </p>
                      </div>
                      {!s.current && confirm !== s.ref && (
                        <button className={`session-signout ${ghostBtn} px-4`} onClick={() => setConfirm(s.ref)} disabled={busy}>Sign out</button>
                      )}
                    </div>
                    {confirm === s.ref && (
                      <div className="session-confirm mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:flex-row sm:items-center">
                        <p className="flex-1 text-xs text-white/70">Sign out this {s.device}? It needs the email link again to get back in.</p>
                        <div className="flex gap-2">
                          <button className="session-confirm-go min-h-[44px] flex-1 rounded-lg bg-red-500/90 px-4 text-sm font-medium text-white disabled:opacity-50 sm:min-h-[36px] sm:flex-none"
                            onClick={() => revoke({ action: 'revoke', ref: s.ref })} disabled={busy}>{busy ? 'One moment…' : 'Sign out'}</button>
                          <button className="min-h-[44px] flex-1 rounded-lg px-4 text-sm text-zinc-400 sm:min-h-[36px] sm:flex-none" onClick={() => setConfirm(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {others.length > 0 && (confirm === 'others' ? (
                <div id="security-others-confirm" className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:flex-row sm:items-center">
                  <p className="flex-1 text-xs text-white/70">
                    This signs out {others.length} other {others.length === 1 ? 'device' : 'devices'}. This one stays signed in.
                  </p>
                  <div className="flex gap-2">
                    <button id="security-others-go" className="min-h-[44px] flex-1 rounded-lg bg-red-500/90 px-4 text-sm font-medium text-white disabled:opacity-50 sm:min-h-[36px] sm:flex-none"
                      onClick={() => revoke({ action: 'revoke_others' })} disabled={busy}>{busy ? 'One moment…' : `Sign out ${others.length}`}</button>
                    <button className="min-h-[44px] flex-1 rounded-lg px-4 text-sm text-zinc-400 sm:min-h-[36px] sm:flex-none" onClick={() => setConfirm(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button id="security-others" className={`${ghostBtn} w-full sm:w-auto`} onClick={() => setConfirm('others')} disabled={busy}>
                  Sign out all other devices
                </button>
              ))}
            </div>
          )}

          {data && (
            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">Recent activity</h3>
              {data.activity.length === 0 ? (
                <p className="text-xs text-white/40">Nothing yet. Sign-ins, two-step changes, site changes and console openings show up here for 90 days.</p>
              ) : (
                <ol id="security-activity" className="space-y-3">
                  {shown.map((a, i) => (
                    <li key={a.at + i} className="activity-row flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`activity-title ${a.warn ? 'text-amber-300' : 'text-white/80'}`}>{a.title}</p>
                        {a.detail && <p className="activity-detail text-xs text-white/50 break-words">{a.detail}</p>}
                        {a.where && <p className="activity-where text-xs text-white/35 break-words">{a.where}</p>}
                      </div>
                      <time className="shrink-0 text-xs text-white/40" dateTime={a.at}>{when(a.at)}</time>
                    </li>
                  ))}
                </ol>
              )}
              {data.activity.length > 8 && (
                <button id="security-activity-all" className="inline-flex min-h-[44px] items-center text-xs text-[#00C66F] hover:underline sm:min-h-0" onClick={() => setAll(!all)}>
                  {all ? 'Show less' : `Show all ${data.activity.length}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
