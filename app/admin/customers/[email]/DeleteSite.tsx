'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { licenseId: string; siteName: string | null; addonCount: number; blocker: string | null };

const input = 'h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-white focus:border-red-500 focus:outline-none';

// Removes one site (license, connector add-ons, stored status). The button is
// disabled with the reason while the license still runs; the site's name must
// be typed back to confirm.
export function DeleteSite({ licenseId, siteName, addonCount, blocker }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const expected = siteName ?? 'delete';

  async function remove() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/admin/licenses/${licenseId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: typed }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message ?? data.error ?? `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-zinc-800 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {blocker ? <span className="text-amber-300">Cannot delete yet: {blocker}</span> : 'Removes this site, its license and its connector add-ons. The customer stays.'}
        </p>
        {blocker ? (
          <button type="button" disabled className="h-8 cursor-not-allowed rounded-lg border border-zinc-800 px-3 text-xs text-zinc-600">Delete site</button>
        ) : (
          <button type="button" onClick={() => setOpen(!open)} className="h-8 rounded-lg border border-red-900/70 px-3 text-xs text-red-300 hover:bg-red-950/40">
            {open ? 'Cancel' : 'Delete site…'}
          </button>
        )}
      </div>

      {open && !blocker && (
        <div className="space-y-3 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs">
          <p className="text-red-200">
            This permanently deletes the site{addonCount ? ` and its ${addonCount} connector add-on${addonCount === 1 ? '' : 's'}` : ''}. It cannot be undone.
          </p>
          <label className="block space-y-1 text-zinc-400">
            Type <span className="font-mono text-zinc-200">{expected}</span> to confirm
            <input className={input} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <button
            type="button"
            disabled={busy || typed.trim().toLowerCase() !== expected.trim().toLowerCase()}
            onClick={remove}
            className="h-8 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
