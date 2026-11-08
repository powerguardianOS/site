'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BTN, BTN_DANGER } from '../ui';

// Revoke (or reactivate) one license from the list, always behind a confirmation
// that names the site and the customer. Same API as the customer page.
export function RevokeButton({ id, site, email, revoked, founderSites }: { id: string; site: string; email: string; revoked: boolean; founderSites: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function set(status: 'active' | 'revoked') {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/admin/licenses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  const trigger = (
    <button type="button" aria-expanded={open} className={revoked ? BTN : BTN_DANGER} onClick={() => setOpen(!open)}>
      {revoked ? 'Reactivate…' : 'Revoke…'}
    </button>
  );
  if (!open) return trigger;

  // Phone: the confirmation replaces the button in the card. Desktop: a popover
  // anchored to the button, so the table row keeps its shape.
  return (
    <div className="relative w-full md:w-auto">
      <div className="hidden md:block">{trigger}</div>
      <div role="alertdialog" aria-label={revoked ? 'Reactivate license' : 'Revoke license'}
      className={`w-full space-y-3 rounded-lg border p-3 text-left text-sm md:absolute md:right-0 md:top-11 md:z-20 md:w-80 md:shadow-2xl md:shadow-black/60 ${revoked ? 'border-zinc-700 bg-zinc-900' : 'border-red-900/70 bg-[#1a0d10]'}`}>
      {revoked ? (
        <p className="text-zinc-200">Reactivate <b>{site}</b> for {email}? Its controller is allowed again at its next check-in.{founderSites ? ` The ${founderSites} founder site${founderSites === 1 ? '' : 's'} revoked with it come back too.` : ''}</p>
      ) : (
        <p className="text-red-100">
          Revoke <b>{site}</b> for {email}? Its controller is refused at its next check-in and stops when its lease runs out.
          {founderSites ? <> This also revokes its <b>{founderSites} founder site{founderSites === 1 ? '' : 's'}</b>.</> : ''} You can reactivate it later.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={revoked ? BTN : `${BTN} !border-red-700 !bg-red-600 !text-white hover:!bg-red-500`} onClick={() => set(revoked ? 'active' : 'revoked')}>
          {busy ? 'Working…' : revoked ? 'Yes, reactivate' : 'Yes, revoke'}
        </button>
        <button type="button" className={BTN} onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
