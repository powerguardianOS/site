'use client';

// CLOUD-MFA: "Two-step sign-in" card. Everything happens inside the card (no modal, no toast).
import { useState } from 'react';
import type { ReactNode } from 'react';

export type TwoStepStatus = { enabled: boolean; since: string | null; recovery_left: number; required: boolean };
type Setup = { key: string; otpauth: string; qr_svg: string };
type Mode = 'idle' | 'setup' | 'codes' | 'remove' | 'recovery';

async function call(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const r = await fetch('/api/account/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { message: 'No connection. Try again.' } };
  }
}

function CodeField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="123456"
      maxLength={11}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-lg tracking-[0.3em] text-center text-white placeholder-zinc-700 focus:outline-none focus:border-[#00C66F]"
    />
  );
}

export default function TwoStepCard({ initial, extra }: { initial: TwoStepStatus; extra?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<TwoStepStatus | null>(initial);
  const [mode, setMode] = useState<Mode>('idle');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const r = await fetch('/api/account/mfa').catch(() => null);
    if (r?.ok) setStatus(await r.json());
  };

  const reset = () => { setMode('idle'); setCode(''); setError(''); setSetup(null); setCopied(false); };

  const start = async () => {
    setBusy(true); setError('');
    const r = await call({ action: 'start' });
    setBusy(false);
    if (!r.ok) { setError(String(r.data.message ?? 'Something went wrong. Try again.')); return; }
    setSetup(r.data as unknown as Setup); setMode('setup');
  };

  const submit = async (action: 'confirm' | 'remove' | 'recovery') => {
    setBusy(true); setError('');
    const r = await call({ action, code });
    setBusy(false);
    if (!r.ok) { setError(String(r.data.message ?? 'Something went wrong. Try again.')); return; }
    setCode('');
    if (action === 'remove') { reset(); await load(); return; }
    setCodes((r.data.recovery_codes as string[]) ?? []); setMode('codes'); setSetup(null);
    await load();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true); } catch { setCopied(false); }
  };

  const on = status?.enabled === true;
  const since = status?.since ? new Date(status.since).toLocaleDateString() : '';

  return (
    <section id="two-step" className="text-sm">
      {/* ACCOUNT-UI: one quiet line; the details open inline. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-white/50">
          Two-step sign-in:{' '}
          {status !== null && (
            <span id="two-step-state" className={on ? 'text-green-400' : status.required ? 'text-amber-300' : 'text-white/70'}>{on ? 'On' : 'Off'}</span>
          )}
          {' · '}
          <button id="two-step-manage" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); if (expanded) reset(); }}
            className="inline-flex min-h-[44px] items-center text-[#00C66F] hover:underline sm:min-h-0">
            {expanded ? 'Close' : on ? 'Manage' : 'Set up'}
          </button>
        </p>
        {extra}
      </div>

      {expanded && (
      <div className="mt-2 space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <p className="text-sm text-white/50">
        {status === null ? 'Loading…'
          : on ? `On since ${since} · authenticator app · ${status.recovery_left} recovery ${status.recovery_left === 1 ? 'code' : 'codes'} left`
          : 'Off. Signing in only needs the link in your email.'}
      </p>

      {status && !on && status.required && mode === 'idle' && (
        <p className="text-sm text-amber-200/90">Your account manages sites. You will be asked to set this up the next time you sign in, or do it now.</p>
      )}
      {on && status && status.recovery_left <= 3 && mode === 'idle' && (
        <p className="text-sm text-amber-200/90">Only {status.recovery_left} recovery {status.recovery_left === 1 ? 'code' : 'codes'} left. Make new ones.</p>
      )}

      {mode === 'idle' && status && !on && (
        <button id="two-step-setup" onClick={start} disabled={busy}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] disabled:opacity-50">
          {busy ? 'One moment…' : 'Set up'}
        </button>
      )}

      {mode === 'idle' && on && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button id="two-step-new-codes" onClick={() => { setMode('recovery'); setError(''); }}
            className="min-h-[44px] px-4 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:border-zinc-500">New recovery codes</button>
          <button id="two-step-remove" onClick={() => { setMode('remove'); setError(''); }}
            className="min-h-[44px] px-4 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:border-red-500/60 hover:text-red-300">Turn off</button>
        </div>
      )}

      {mode === 'setup' && setup && (
        <div className="space-y-4">
          <p className="text-sm text-white/70"><b className="text-white">1.</b> Add PowerGuardian to an authenticator app on your phone (for example Google Authenticator, Microsoft Authenticator or 1Password).</p>
          <a id="two-step-add-app" href={setup.otpauth}
            className="sm:hidden block w-full min-h-[44px] text-center px-5 py-3 rounded-lg bg-[#00C66F] text-black text-sm font-medium">Add to authenticator app</a>
          <div className="flex justify-center"><div className="rounded-lg overflow-hidden" dangerouslySetInnerHTML={{ __html: setup.qr_svg }} /></div>
          <p className="text-xs text-white/50 text-center">Or scan the code, or type this key:</p>
          <p id="two-step-key" className="font-mono text-sm text-white text-center break-words select-all">{setup.key}</p>
          <p className="text-sm text-white/70"><b className="text-white">2.</b> Type the code the app shows.</p>
          <CodeField id="two-step-code" value={code} onChange={setCode} />
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button id="two-step-confirm" onClick={() => submit('confirm')} disabled={busy || code.trim() === ''}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-medium disabled:opacity-50">{busy ? 'Checking…' : 'Turn on'}</button>
            <button onClick={reset} className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm text-zinc-400">Cancel</button>
          </div>
        </div>
      )}

      {(mode === 'remove' || mode === 'recovery') && (
        <div className="space-y-3">
          <p className="text-sm text-white/70">
            {mode === 'remove'
              ? (status?.required ? 'Enter a code from your app (or a recovery code) to turn it off. Because your account manages sites, you will be asked to set it up again at your next sign-in.' : 'Enter a code from your app (or a recovery code) to turn it off.')
              : 'Enter a code from your app to make 10 new recovery codes. The old ones stop working.'}
          </p>
          <CodeField id="two-step-code" value={code} onChange={setCode} />
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button id="two-step-go" onClick={() => submit(mode)} disabled={busy || code.trim() === ''}
              className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 ${mode === 'remove' ? 'bg-red-500/90 text-white' : 'bg-[#00C66F] text-black'}`}>
              {busy ? 'Checking…' : mode === 'remove' ? 'Turn off two-step sign-in' : 'Make new codes'}
            </button>
            <button onClick={reset} className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm text-zinc-400">Cancel</button>
          </div>
        </div>
      )}

      {mode === 'codes' && (
        <div className="space-y-3">
          <p className="text-sm text-white/70">Save these recovery codes somewhere safe, like a password manager. Each one lets you sign in once if you lose your phone. They are shown only now.</p>
          <ol id="two-step-codes" className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-white list-decimal list-inside select-all">
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ol>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={copy} className="min-h-[44px] px-4 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-200">{copied ? 'Copied' : 'Copy codes'}</button>
            <button id="two-step-done" onClick={() => { setCodes([]); reset(); }}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-medium">I saved them</button>
          </div>
        </div>
      )}
      </div>
      )}
    </section>
  );
}
