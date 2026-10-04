'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type SiteInfo = {
  id: string;
  name: string | null;
  hostname: string | null;
  controllerShort: string | null;
  offlineAllowed: boolean;
  copies: { controller_id: string; hostname: string; first_seen: string; decision?: string }[];
  movedAway: { until: string }[];
};

const btn = 'inline-flex h-8 items-center rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50';
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const lockDate = (first: string) => fmt(new Date(new Date(first).getTime() + 30 * 86_400_000).toISOString());

async function post(path: string, method: string, body: unknown) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// A sensitive action first needs a fresh e-mail code; the server enforces it, this
// just walks the customer through it and then retries the action.
function useConfirmed() {
  const [pending, setPending] = useState<null | (() => Promise<void>)>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true); setError('');
    const r = await post('/api/account/reconfirm', 'POST', {});
    setBusy(false);
    r.ok ? setSent(true) : setError(r.data.error === 'rate_limited' ? 'Too many codes. Try again in an hour.' : 'Could not send the code.');
  }
  async function verify() {
    setBusy(true); setError('');
    const r = await post('/api/account/reconfirm/verify', 'POST', { code });
    if (!r.ok) { setBusy(false); setError(r.data.message ?? 'Wrong code.'); return; }
    const retry = pending; setPending(null); setSent(false); setCode('');
    setBusy(false);
    if (retry) await retry();
  }
  const dialog = pending ? (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
      <p>For your security, confirm this with a code we e-mail to your account address.</p>
      {!sent ? (
        <button className={btn} disabled={busy} onClick={start}>Send me a code</button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="rc">Code</label>
          <input id="rc" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="h-8 w-28 rounded-lg border border-white/20 bg-black/30 px-3 font-mono text-sm tracking-widest text-white outline-none" />
          <button className={btn} disabled={busy || code.length !== 6} onClick={verify}>Confirm</button>
        </div>
      )}
      <button className="underline" onClick={() => { setPending(null); setSent(false); setCode(''); }}>Cancel</button>
      {error && <p className="text-red-300">{error}</p>}
    </div>
  ) : null;
  return { dialog, ask: (fn: () => Promise<void>) => setPending(() => fn) };
}

export default function SiteControls({ site }: { site: SiteInfo }) {
  const router = useRouter();
  const [name, setName] = useState(site.name ?? '');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [cid, setCid] = useState('');
  const [lease, setLease] = useState<string | null>(null);
  const confirmed = useConfirmed();

  async function act(action: string, controller_id?: string) {
    setBusy(true); setMsg('');
    const run = async () => {
      const r = await post(`/api/account/sites/${site.id}/actions`, 'POST', { action, controller_id });
      if (r.status === 403 && r.data.error === 'reconfirm_required') { setBusy(false); confirmed.ask(run); return; }
      setBusy(false);
      if (!r.ok) { setMsg(r.data.message ?? r.data.error ?? 'Failed'); return; }
      if (action === 'offline_lease') setLease(r.data.lease);
      router.refresh();
    };
    await run();
  }
  async function rename() {
    setBusy(true); setMsg('');
    const r = await post(`/api/account/sites/${site.id}`, 'PATCH', { name });
    setBusy(false);
    if (!r.ok) { setMsg(r.data.message ?? 'Could not rename'); return; }
    setEditing(false); router.refresh();
  }

  const activeCopies = site.copies.filter((c) => c.decision !== 'removed');
  const moved = site.movedAway; // already limited to countdowns that are still running (server side)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <label className="sr-only" htmlFor={`n-${site.id}`}>Site name</label>
            <input id={`n-${site.id}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="h-8 w-56 rounded-lg border border-white/20 bg-black/30 px-3 text-sm text-white outline-none" />
            <button className={btn} disabled={busy || !name.trim()} onClick={rename}>Save</button>
            <button className={btn} onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <button className="text-xs text-white/50 underline hover:text-white" onClick={() => setEditing(true)}>Rename site</button>
        )}
      </div>

      {moved.map((m) => (
        <div key={m.until} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <b>This site’s license moved to another controller.</b> The previous controller stops working on {fmt(m.until)}. Add a license for it, or write to sales@powerguardian.cloud.
        </div>
      ))}

      {activeCopies.map((c) => (
        <div key={c.controller_id} className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <div><b>A copy of this controller was detected:</b> <span className="font-mono">{c.hostname || c.controller_id.slice(0, 8)}</span>. It keeps working until {lockDate(c.first_seen)}. Your original is not affected. {c.decision === 'relink' && 'You chose to keep both: link it to its own site license in its setup wizard.'}</div>
          <div className="flex flex-wrap gap-2">
            <button className={`${btn} !border-amber-400/60 !text-amber-100`} disabled={busy} onClick={() => act('replace', c.controller_id)}>Replace {site.hostname || 'the old controller'} with this</button>
            <button className={btn} disabled={busy} onClick={() => act('keep', c.controller_id)}>Keep both</button>
            <button className={btn} disabled={busy} onClick={() => act('remove', c.controller_id)}>Remove</button>
          </div>
          <p className="text-amber-200/70">Replace moves this site, its license and its connector licenses to the copy now, and retires the old controller.</p>
        </div>
      ))}

      {confirmed.dialog}
      {msg && <p className="text-xs text-red-300">{msg}</p>}

      {site.controllerShort && (
        <div>
          <button className="text-xs text-white/50 underline hover:text-white" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Manage this site’s controller'}</button>
          {open && (
            <div className="mt-2 space-y-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <div>Controller <span className="font-mono">{site.hostname || 'unnamed'} · {site.controllerShort}…</span></div>
              <div className="space-y-1">
                <button className={`${btn} !border-red-400/40 !text-red-200`} disabled={busy} onClick={() => act('release')}>Release this site…</button>
                <p className="text-white/50">Frees the site for another controller. The current controller stops at its next contact with the cloud.</p>
              </div>
              {site.offlineAllowed ? (
                <div className="space-y-2">
                  <div className="font-medium text-white/80">Offline license (12 months)</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`cid-${site.id}`}>Controller ID</label>
                    <input id={`cid-${site.id}`} value={cid} onChange={(e) => setCid(e.target.value.trim())} placeholder="Controller ID from Settings → License" className="h-8 w-80 rounded-lg border border-white/20 bg-black/30 px-3 font-mono text-xs text-white outline-none" />
                    <button className={btn} disabled={busy || cid.length < 32} onClick={() => act('offline_lease', cid)}>Generate</button>
                  </div>
                  {lease && (
                    <div className="space-y-1">
                      <textarea readOnly rows={3} value={lease} className="w-full rounded-lg border border-white/15 bg-black/30 p-2 font-mono text-[11px] text-white/80" />
                      <a className="text-[#00C66F] underline" href={`data:text/plain;charset=utf-8,${encodeURIComponent(lease)}`} download="powerguardian-offline.lease">Download the file</a>
                      <span className="text-white/50"> · load it on the controller under Settings → License</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
