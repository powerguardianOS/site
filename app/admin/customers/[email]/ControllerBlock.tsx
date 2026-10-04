'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  licenseId: string;
  siteName: string | null;
  hostname: string | null;
  controllerShort: string | null;
  claimedAt: string | null;
  copies: { hostname: string; controller_short: string; first_seen: string; decision?: string }[];
  retired: { controller_short: string; until: string; reason: string }[];
  offlineAllowed: boolean;
};

const btn = 'inline-flex h-8 items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50';
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

async function call(path: string, method: string, body?: unknown) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message ?? data.error ?? `HTTP ${r.status}`);
}

// The controller that holds a site, as the admin sees it: who it is, since when,
// copies waiting for a decision, controllers on a countdown, and the controls.
export function ControllerBlock(p: Props) {
  const router = useRouter();
  const [name, setName] = useState(p.siteName ?? '');
  const [editing, setEditing] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError('');
    try { await fn(); setEditing(false); setConfirmRelease(false); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'failed'); } finally { setBusy(false); }
  }
  const patch = (body: unknown) => call(`/api/admin/licenses/${p.licenseId}`, 'PATCH', body);

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm">
        <div className="min-w-0">
          <div className="text-xs text-zinc-500">Linked controller</div>
          {p.controllerShort ? (
            <div className="font-mono text-[13px] text-zinc-200">{p.hostname || 'unnamed'} · id {p.controllerShort}…</div>
          ) : (
            <div className="text-zinc-400">Not linked yet</div>
          )}
        </div>
        {p.claimedAt && <div><div className="text-xs text-zinc-500">Linked since</div><div className="text-zinc-200">{fmt(p.claimedAt)}</div></div>}
        <div className="ml-auto flex flex-wrap gap-2">
          <button className={btn} onClick={() => setEditing(!editing)} disabled={busy}>Rename</button>
          {p.controllerShort && <button className={`${btn} !border-amber-900/70 !text-amber-300`} onClick={() => setConfirmRelease(!confirmRelease)} disabled={busy}>Release controller…</button>}
        </div>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`sn-${p.licenseId}`}>Site name</label>
          <input id={`sn-${p.licenseId}`} className="h-8 w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white focus:border-[#00C66F] focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <button className={btn} disabled={busy || !name.trim()} onClick={() => run(() => patch({ site_name: name }))}>Save name</button>
        </div>
      )}

      {confirmRelease && (
        <div className="space-y-2 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs">
          <p className="text-amber-200">Releasing frees this site for another controller, for instance after a hardware swap. It also rotates the token, so the current controller stops at its next contact until it is linked again. The site, its license and its add-ons stay as they are.</p>
          <div className="flex gap-2">
            <button className={`${btn} !text-amber-300`} disabled={busy} onClick={() => run(() => call(`/api/admin/licenses/${p.licenseId}/release`, 'POST'))}>Yes, release</button>
            <button className={btn} onClick={() => setConfirmRelease(false)}>Cancel</button>
          </div>
        </div>
      )}

      {p.copies.filter((c) => c.decision !== 'removed').map((c) => (
        <div key={c.controller_short} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-4 py-2 text-xs text-amber-200">
          <span className="h-2 w-2 rounded-[2px] bg-amber-400" />
          Unconfirmed copy <span className="font-mono">{c.hostname || 'unnamed'} · {c.controller_short}…</span> first seen {fmt(c.first_seen)}, locks {fmt(new Date(new Date(c.first_seen).getTime() + 30 * 86_400_000).toISOString())} unless the customer decides{c.decision === 'relink' ? ' (will be linked to its own site)' : ''}.
        </div>
      ))}
      {p.retired.map((r) => (
        <div key={r.controller_short + r.until} className="rounded-lg border border-zinc-800 px-4 py-2 text-xs text-zinc-400">
          Previous controller <span className="font-mono">{r.controller_short}…</span> ({r.reason}) stops working on {fmt(r.until)}.
        </div>
      ))}

      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input type="checkbox" checked={p.offlineAllowed} disabled={busy} onChange={(e) => run(() => patch({ offline_allowed: e.target.checked }))} className="accent-[#00C66F]" />
        Allow an offline license for this site (12 months, for sites without internet)
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
