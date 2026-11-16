'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { email: string; licenseCount: number; blocker: string | null; isAdminAccount: boolean };

const field = 'h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-base sm:h-9 sm:text-sm text-white focus:outline-none focus:border-red-500';

// Deleting is irreversible, so the button is disabled with the reason while
// anything is still in use, and the e-mail must be typed back to confirm.
export function DeleteTenant({ email, licenseCount, blocker, isAdminAccount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reason = isAdminAccount ? 'This is the global admin account and cannot be deleted.' : blocker;

  async function remove() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/admin/tenants/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: typed }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message ?? data.error ?? `HTTP ${r.status}`);
      router.push('/admin/tenants');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-red-950 bg-red-950/10 p-5">
      <h2 className="text-sm font-semibold text-red-300">Delete customer</h2>
      <p className="text-xs text-zinc-400">
        Permanently removes this account{licenseCount ? ` and its ${licenseCount} license${licenseCount === 1 ? '' : 's'}` : ''} with their stored site status. This cannot be undone.
        The customer can still sign in later, but would start as a new account without a license.
      </p>

      {reason ? (
        <div className="space-y-2">
          <button type="button" disabled className="h-11 cursor-not-allowed rounded-lg border border-zinc-800 px-3.5 text-sm text-zinc-600 sm:h-8 sm:text-xs">Delete customer</button>
          <p className="text-xs text-amber-300">Not possible yet: {reason}</p>
        </div>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-lg border border-red-900 px-3.5 text-sm text-red-300 hover:bg-red-950/40 sm:h-8 sm:text-xs">
          Delete customer…
        </button>
      ) : (
        <div className="space-y-2">
          <label className="block space-y-1 text-xs text-zinc-400">
            Type <span className="font-mono text-zinc-200">{email}</span> to confirm
            <input className={field} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy || typed.trim().toLowerCase() !== email}
              onClick={remove}
              className="h-11 rounded-lg bg-red-600 px-3.5 text-sm font-medium sm:h-8 sm:text-xs text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped(''); setError(''); }} className="h-11 rounded-lg border border-zinc-700 px-3.5 text-sm text-zinc-300 hover:bg-zinc-900 sm:h-8 sm:text-xs">Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
