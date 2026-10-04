'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TERMS, termEnd } from '../../terms';

export type Addon = { id: string; connector_limit: number; expires_at: string | null; status: 'active' | 'revoked' | 'expired'; created_at: string };

const btn = 'inline-flex h-8 items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50';
const input = 'h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white focus:border-[#00C66F] focus:outline-none';
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never');

async function send(path: string, method: string, body?: unknown) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message ?? data.error ?? `HTTP ${r.status}`);
}

function Row({ a, onDone, onError }: { a: Addon; onDone: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState<'expire' | 'remove' | null>(null);
  const [busy, setBusy] = useState(false);
  const ended = a.status === 'revoked' || (a.expires_at !== null && new Date(a.expires_at).getTime() < Date.now());
  const label = a.status === 'revoked' ? 'Revoked' : ended ? 'Expired' : 'Running';
  const tone = ended ? 'text-amber-300' : 'text-green-300';
  const dot = ended ? 'bg-amber-400 rounded-[2px]' : 'bg-green-400 rounded-full';
  const month = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; })();

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); setOpen(null); onDone(); } catch (e) { onError(e instanceof Error ? e.message : 'failed'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 border-t border-zinc-800/70 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="w-28 text-sm font-medium text-white">+{a.connector_limit} connector{a.connector_limit === 1 ? '' : 's'}</div>
        <div className={`inline-flex w-24 items-center gap-1.5 text-xs ${tone}`}><span className={`h-2 w-2 ${dot}`} />{label}</div>
        <div className="flex-1 text-xs text-zinc-400">{ended ? 'Ended' : 'Ends'} {fmt(a.expires_at)}</div>
        <div className="flex gap-2">
          {!ended && <button className={`${btn} !border-amber-900/70 !text-amber-300`} disabled={busy} onClick={() => setOpen(open === 'expire' ? null : 'expire')}>Expire…</button>}
          <button className={`${btn} !border-red-900/70 !text-red-300`} disabled={busy} onClick={() => setOpen(open === 'remove' ? null : 'remove')}>Remove</button>
        </div>
      </div>
      {open === 'expire' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs">
          <span className="mr-1 text-amber-200">Let this add-on run out:</span>
          <button className={`${btn} !text-amber-300`} disabled={busy} onClick={() => run(() => send(`/api/admin/licenses/${a.id}`, 'PATCH', { expires_at: month.toISOString() }))}>
            In 1 month <span className="ml-1.5 text-zinc-500">{fmt(month.toISOString())}</span>
          </button>
          <button className={`${btn} !border-red-900/70 !text-red-300`} disabled={busy} onClick={() => run(() => send(`/api/admin/licenses/${a.id}`, 'PATCH', { expires_at: new Date().toISOString() }))}>Now</button>
          <button className={btn} onClick={() => setOpen(null)}>Cancel</button>
        </div>
      )}
      {open === 'remove' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs">
          <span className="mr-1 text-red-200">Delete this add-on permanently? Refused while the site still needs its connectors.</span>
          <button className={`${btn} !text-red-300`} disabled={busy} onClick={() => run(() => send(`/api/admin/licenses/${a.id}`, 'DELETE'))}>Yes, delete</button>
          <button className={btn} onClick={() => setOpen(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// Connector add-ons of one site: separate licenses, each with its own end date.
export function AddonList({ parentId, addons, unlimited }: { parentId: string; addons: Addon[]; unlimited: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [count, setCount] = useState('1');
  const [term, setTerm] = useState<string>('m1');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    if (term === 'custom' && !custom) { setError('Pick an end date, or choose another term.'); return; }
    setBusy(true); setError('');
    try {
      await send('/api/admin/licenses', 'POST', { plan: 'addon_connector', parent_id: parentId, connector_limit: Number(count), expires_at: term === 'custom' ? custom : termEnd(term) });
      setAdding(false); setCount('1'); setTerm('m1'); setCustom('');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'failed'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-1 border-t border-zinc-800 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Connector add-ons</h3>
          <p className="text-xs text-zinc-500">{unlimited ? 'This site has unlimited connectors.' : 'Extra connectors for this site, each with its own end date.'}</p>
        </div>
        {!unlimited && <button className={btn} onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ Add connectors'}</button>}
      </div>

      {adding && (
        <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-xs text-zinc-400"><span className="mb-1 block">Connectors</span>
              <input className={input} type="number" min={1} max={1000} value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
            <label className="block text-xs text-zinc-400"><span className="mb-1 block">Runs for</span>
              <select className={input} value={term} onChange={(e) => setTerm(e.target.value)}>{TERMS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
            </label>
            {term === 'custom' ? (
              <label className="block text-xs text-zinc-400"><span className="mb-1 block">Ends on</span>
                <input className={input} type="date" value={custom} onChange={(e) => setCustom(e.target.value)} />
              </label>
            ) : (
              <div className="text-xs text-zinc-400"><span className="mb-1 block">Ends on</span>
                <div className="flex h-9 items-center rounded-lg border border-zinc-800 px-3 text-sm text-zinc-300">{fmt(termEnd(term))}</div>
              </div>
            )}
          </div>
          <button className={btn} disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Add add-on'}</button>
        </div>
      )}

      {addons.length === 0 && !adding && <p className="py-2 text-xs text-zinc-500">No add-ons.</p>}
      {addons.map((a) => <Row key={`${a.id}-${a.expires_at}-${a.status}`} a={a} onDone={() => router.refresh()} onError={setError} />)}
      {error && <p className="pt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
