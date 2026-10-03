'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lic = {
  id: string; plan: string; status: 'active' | 'revoked' | 'expired';
  connector_limit: number; expires_at: string | null; notes: string; created_at: string;
};

const btn = 'border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-lg px-3 py-1.5 text-xs transition-colors disabled:opacity-50';
const field = 'rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#00C66F]';

// Extends from whichever is later: now or the current expiry, so renewing an
// already-lapsed license never hands out a date in the past.
function addMonths(from: string | null, months: number): string {
  const base = from && new Date(from).getTime() > Date.now() ? new Date(from) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString();
}

export function LicenseCard({ license }: { license: Lic }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'revoke' | 'rotate' | null>(null);
  const [limit, setLimit] = useState(String(license.connector_limit));
  const [plan, setPlan] = useState(license.plan);
  const [notes, setNotes] = useState(license.notes);
  const [expires, setExpires] = useState(license.expires_at ? license.expires_at.slice(0, 10) : '');

  const expired = license.status === 'active' && license.expires_at && new Date(license.expires_at).getTime() < Date.now();
  const shown = license.status === 'revoked' ? 'revoked' : expired ? 'expired' : 'active';
  const badge = { active: 'bg-green-900/40 text-green-400', expired: 'bg-amber-900/40 text-amber-400', revoked: 'bg-red-900/40 text-red-400' }[shown];

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setConfirm(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: unknown) => call(`/api/admin/licenses/${license.id}`, 'PATCH', body);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs font-medium uppercase">{license.plan}</span>
          <span className={`${badge} px-2 py-0.5 rounded-full text-xs`}>{shown}</span>
        </div>
        <p className="text-xs text-zinc-500">
          Created {new Date(license.created_at).toLocaleDateString()} · Expires{' '}
          {license.expires_at ? new Date(license.expires_at).toLocaleDateString() : 'never'} · Limit{' '}
          {license.connector_limit === 0 ? '∞' : license.connector_limit}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={btn} disabled={busy} onClick={() => patch({ expires_at: addMonths(license.expires_at, 1) })}>+1 month</button>
        <button className={btn} disabled={busy} onClick={() => patch({ expires_at: addMonths(license.expires_at, 12) })}>+1 year</button>
        {license.status === 'revoked' ? (
          <button className={btn} disabled={busy} onClick={() => patch({ status: 'active' })}>Reactivate</button>
        ) : (
          <button className={`${btn} !text-red-400`} disabled={busy} onClick={() => setConfirm('revoke')}>Revoke</button>
        )}
        <button className={`${btn} !text-amber-400`} disabled={busy} onClick={() => setConfirm('rotate')}>Rotate token</button>
      </div>

      {confirm === 'revoke' && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs space-y-2">
          <p className="text-red-300">The customer&apos;s controller will report this license as invalid on its next check. Existing connectors keep working; new ones are blocked. Reversible via Reactivate.</p>
          <div className="flex gap-2">
            <button className={`${btn} !text-red-400`} disabled={busy} onClick={() => patch({ status: 'revoked' })}>Yes, revoke</button>
            <button className={btn} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {confirm === 'rotate' && (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs space-y-2">
          <p className="text-amber-300">The current token stops working immediately — license checks <em>and</em> the cloud relay. The customer must re-link their license on the controller (Settings → License, email code). This cannot be undone.</p>
          <div className="flex gap-2">
            <button className={`${btn} !text-amber-400`} disabled={busy} onClick={() => call(`/api/admin/licenses/${license.id}/rotate-token`, 'POST')}>Yes, rotate</button>
            <button className={btn} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-zinc-400">Plan
          <select className={`${field} w-full`} value={plan} onChange={e => setPlan(e.target.value)}>
            <option value="home">Home</option><option value="pro">Pro</option>
            <option value="founder">Founder</option><option value="addon_connector">Add-on connector</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-400">Connector limit (0 = ∞)
          <input className={`${field} w-full`} type="number" min={0} max={10000} value={limit} onChange={e => setLimit(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-zinc-400">Expires (empty = never)
          <input className={`${field} w-full`} type="date" value={expires} onChange={e => setExpires(e.target.value)} />
        </label>
      </div>

      <label className="block space-y-1 text-xs text-zinc-400">Internal notes
        <textarea className={`${field} w-full`} rows={2} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />
      </label>

      <div className="flex items-center gap-3">
        <button
          className={btn}
          disabled={busy}
          onClick={() => patch({ plan, connector_limit: Number(limit), expires_at: expires || null, notes })}
        >
          Save changes
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
