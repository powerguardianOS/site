'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lic = {
  id: string; plan: string; status: 'active' | 'revoked' | 'expired';
  connector_limit: number; expires_at: string | null; notes: string; created_at: string;
};

const btn = 'inline-flex h-8 items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50';
const input = 'h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white focus:border-[#00C66F] focus:outline-none';
const label = 'block text-xs text-zinc-400';

// Extends from whichever is later: now or the current expiry, so renewing an
// already-lapsed license never hands out a date in the past.
function addMonths(from: string | null, months: number): string {
  const base = from && new Date(from).getTime() > Date.now() ? new Date(from) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString();
}

function Stat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-zinc-500">{title}</div>
      <div className="mt-1 text-sm text-zinc-100">{children}</div>
    </div>
  );
}

// The license of one site: a compact summary, the quick actions in one row, and
// the full edit form folded away so the page stays calm.
export function LicenseCard({ license, connectorsUsed = 0 }: { license: Lic; connectorsUsed?: number }) {
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
  const badge = { active: 'text-green-300', expired: 'text-amber-300', revoked: 'text-red-300' }[shown];
  const dot = { active: 'bg-green-400 rounded-full', expired: 'bg-amber-400 rounded-[2px]', revoked: 'bg-red-400 rounded-none' }[shown];
  const unlimited = license.connector_limit === 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((connectorsUsed / license.connector_limit) * 100));

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
    <div className="space-y-4 border-t border-zinc-800 pt-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat title="Plan">
          <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs font-medium uppercase">{license.plan}</span>
        </Stat>
        <Stat title="License">
          <span className={`inline-flex items-center gap-1.5 capitalize ${badge}`}><span className={`h-2 w-2 ${dot}`} />{shown}</span>
        </Stat>
        <Stat title="Connectors">
          {unlimited ? (
            <span>{connectorsUsed} <span className="text-zinc-500">· unlimited</span></span>
          ) : (
            <div className="space-y-1.5">
              <span>{connectorsUsed} of {license.connector_limit}</span>
              <div className="h-1.5 w-full max-w-[120px] overflow-hidden rounded bg-zinc-800">
                <div className={`h-full ${pct >= 100 ? 'bg-amber-400' : 'bg-[#00C66F]'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </Stat>
        <Stat title="Expires">
          {license.expires_at ? new Date(license.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}
        </Stat>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} disabled={busy} onClick={() => patch({ expires_at: addMonths(license.expires_at, 1) })}>+1 month</button>
        <button className={btn} disabled={busy} onClick={() => patch({ expires_at: addMonths(license.expires_at, 12) })}>+1 year</button>
        <button
          className={btn}
          disabled={busy || unlimited}
          title={unlimited ? 'Already unlimited' : `Allow ${license.connector_limit + 1} connectors on this site`}
          onClick={() => patch({ connector_limit: license.connector_limit + 1 })}
        >
          +1 connector
        </button>
        <span className="mx-1 hidden h-5 w-px bg-zinc-800 sm:block" aria-hidden="true" />
        <button className={`${btn} !border-amber-900/70 !text-amber-300`} disabled={busy} onClick={() => setConfirm('rotate')}>Rotate token</button>
        {license.status === 'revoked' ? (
          <button className={btn} disabled={busy} onClick={() => patch({ status: 'active' })}>Reactivate</button>
        ) : (
          <button className={`${btn} !border-red-900/70 !text-red-300`} disabled={busy} onClick={() => setConfirm('revoke')}>Revoke</button>
        )}
      </div>

      {confirm === 'revoke' && (
        <div className="space-y-2 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs">
          <p className="text-red-200">This site&apos;s controller will report the license as invalid on its next check. Existing connectors keep working; new ones are blocked. Reversible with Reactivate.</p>
          <div className="flex gap-2">
            <button className={`${btn} !text-red-300`} disabled={busy} onClick={() => patch({ status: 'revoked' })}>Yes, revoke</button>
            <button className={btn} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {confirm === 'rotate' && (
        <div className="space-y-2 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs">
          <p className="text-amber-200">The current token stops working immediately — license checks and the cloud relay. The customer must link the license again on the controller (Settings → License, e-mail code). Cannot be undone.</p>
          <div className="flex gap-2">
            <button className={`${btn} !text-amber-300`} disabled={busy} onClick={() => call(`/api/admin/licenses/${license.id}/rotate-token`, 'POST')}>Yes, rotate</button>
            <button className={btn} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}

      <details className="group rounded-lg border border-zinc-800">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200">
          <span>Edit license details</span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="space-y-4 border-t border-zinc-800 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={label}><span className="mb-1 block">Plan</span>
              <select className={input} value={plan} onChange={e => setPlan(e.target.value)}>
                <option value="home">Home</option><option value="pro">Pro</option><option value="founder">Founder</option>
                {license.plan === 'addon_connector' && <option value="addon_connector">Add-on connector (legacy)</option>}
              </select>
            </label>
            <label className={label}><span className="mb-1 block">Connectors (0 = unlimited)</span>
              <input className={input} type="number" min={0} max={10000} value={limit} onChange={e => setLimit(e.target.value)} />
            </label>
            <label className={label}><span className="mb-1 block">Expires (empty = never)</span>
              <input className={input} type="date" value={expires} onChange={e => setExpires(e.target.value)} />
            </label>
          </div>
          <label className={label}><span className="mb-1 block">Internal notes (never shown to the customer)</span>
            <textarea className={`${input} h-auto py-2`} rows={2} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
          <div className="flex items-center gap-3">
            <button className={btn} disabled={busy} onClick={() => patch({ plan, connector_limit: Number(limit), expires_at: expires || null, notes })}>Save changes</button>
          </div>
        </div>
      </details>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
