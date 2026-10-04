'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TERMS, termEnd } from '../../terms';

// Suggested limits only — editable. 0 = unlimited (see /api/license/verify).
const DEFAULT_LIMIT: Record<string, number> = { home: 1, pro: 5, founder: 0, addon_connector: 1 };

const field = 'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00C66F]';

export default function NewLicenseForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const locked = initialEmail !== '';
  const [plan, setPlan] = useState('pro');
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT.pro));
  const [term, setTerm] = useState<string>('m1');
  const [custom, setCustom] = useState('');
  const [termTouched, setTermTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [siteName, setSiteName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (term === 'custom' && !custom) { setError('Pick an end date, or choose another term.'); return; }
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, plan, connector_limit: Number(limit),
          expires_at: term === 'custom' ? custom : termEnd(term), notes, site_name: siteName,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      router.push(`/admin/customers/${encodeURIComponent(email.trim().toLowerCase())}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href={locked ? `/admin/customers/${encodeURIComponent(initialEmail)}` : '/admin/tenants'} className="text-xs text-zinc-500 hover:text-zinc-300">← {locked ? initialEmail : 'Tenants'}</Link>
        <h1 className="text-2xl font-semibold mt-2">{locked ? 'Add a site' : 'New customer license'}</h1>
        <p className="mt-1 text-sm text-zinc-400">{locked ? 'A site is one location with one controller and its connectors. This creates the license for a new site on this customer. To allow more connectors on an existing site, use “+1 connector” on that site’s license instead.' : 'Creates the customer account if needed, with its first site.'}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Customer e-mail{locked ? ' (fixed)' : ''}</span>
          <input className={`${field} ${locked ? 'opacity-70' : ''}`} type="email" required readOnly={locked} value={email} onChange={e => setEmail(e.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Site name (optional)</span>
          <input className={field} value={siteName} maxLength={80} placeholder="e.g. Server room A" onChange={e => setSiteName(e.target.value)} />
          <span className="block text-xs text-zinc-500">The customer sees this name when he links his controller, and in the portal. He can change it later.</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Plan</span>
            <select
              className={field}
              value={plan}
              onChange={e => { setPlan(e.target.value); setLimit(String(DEFAULT_LIMIT[e.target.value] ?? 1)); if (!termTouched) setTerm(e.target.value === 'founder' ? 'never' : 'm1'); }}
            >
              <option value="home">Home</option>
              <option value="pro">Pro</option>
              <option value="founder">Founder</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Connectors on this site (0 = unlimited)</span>
            <input className={field} type="number" min={0} max={10000} required value={limit} onChange={e => setLimit(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Runs for</span>
            <select className={field} value={term} onChange={e => { setTerm(e.target.value); setTermTouched(true); }}>
              {TERMS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          {term === 'custom' ? (
            <label className="block space-y-1">
              <span className="text-xs text-zinc-400">Ends on</span>
              <input className={field} type="date" value={custom} onChange={e => setCustom(e.target.value)} />
            </label>
          ) : (
            <div className="space-y-1">
              <span className="text-xs text-zinc-400">Ends on</span>
              <div className="flex h-[38px] items-center rounded-lg border border-zinc-800 px-3 text-sm text-zinc-300">
                {termEnd(term) ? new Date(termEnd(term)!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}
              </div>
            </div>
          )}
        </div>
        <p className="-mt-2 text-xs text-zinc-500">You can let a license expire later (in a month, or immediately) and extend it again from the tenant page.</p>

        <label className="block space-y-1">
          <span className="text-xs text-zinc-400">Internal notes (never shown to the customer)</span>
          <textarea className={field} rows={3} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="bg-[#00C66F] text-black hover:bg-[#00b564] rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {busy ? 'Creating…' : locked ? 'Create site license' : 'Create license'}
        </button>
      </form>
    </div>
  );
}
