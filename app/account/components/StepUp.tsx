'use client';

// B2 (review): the one inline step before adding a second step (app/lib/step-up.ts). Two-step off: "We sent a code to
// r***@gmail.com — enter it to add a passkey." Two-step on: a passkey of this account, or a code from the app / a
// recovery code. Inside the card that asked; no modal.
import { useEffect, useState } from 'react';
import { cancelled, passkeySupported, postJson, confirmWithPasskey } from '@/app/lib/webauthn-client';

type Need = { need: 'email'; to: string } | { need: 'second'; passkey: boolean; totp: boolean };

export default function StepUp({ what, onDone, onCancel }: { what: string; onDone: () => void; onCancel: () => void }) {
  const [need, setNeed] = useState<Need | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    postJson('/api/account/step-up', { action: 'start' }).then((r) => {
      if (!live) return;
      if (r.ok) setNeed(r.data as unknown as Need); else setError(String(r.data.message ?? 'Something went wrong. Try again.'));
    });
    return () => { live = false; };
  }, []);

  const verify = async (viaPasskey: boolean) => {
    setBusy(true); setError('');
    let body: Record<string, unknown> = { action: 'verify', code };
    if (viaPasskey) {
      try {
        const credential = await confirmWithPasskey();
        if (!credential) { setBusy(false); setError('Could not start the confirmation. Try again.'); return; }
        body = { action: 'verify', credential };
      } catch (e) {
        setBusy(false); if (!cancelled(e)) setError('That passkey did not work. Try again.'); return;
      }
    }
    const r = await postJson('/api/account/step-up', body);
    setBusy(false);
    if (!r.ok) { setError(String(r.data.message ?? 'That did not work. Try again.')); return; }
    onDone();
  };

  return (
    <div id="step-up" className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-3">
      <p className="text-sm text-white/70" id="step-up-text">
        {need === null ? (error ? '' : 'One moment…')
          : need.need === 'email' ? <>We sent a code to <span className="text-white">{need.to}</span>. Enter it {what}.</>
          : `Confirm it is you ${what}: ${[need.passkey ? 'use a passkey' : '', need.totp ? 'a code from your app' : '', 'or a recovery code'].filter(Boolean).join(', ')}.`}
      </p>
      {need?.need === 'second' && need.passkey && passkeySupported() && (
        <button id="step-up-passkey" onClick={() => verify(true)} disabled={busy}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-medium disabled:opacity-50">
          {busy ? 'Checking…' : 'Confirm with a passkey'}
        </button>
      )}
      {need && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="step-up-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code"
            inputMode={need.need === 'email' ? 'numeric' : 'text'} placeholder={need.need === 'email' ? '6-digit code' : 'Code from your app, or a recovery code'}
            className="flex-1 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-base text-white placeholder-zinc-600 focus:outline-none focus:border-[#00C66F]" />
          <button id="step-up-go" onClick={() => verify(false)} disabled={busy || code.trim() === ''}
            className="min-h-[44px] px-4 rounded-lg border border-zinc-700 text-sm text-zinc-100 disabled:opacity-40">Confirm</button>
          <button onClick={onCancel} className="min-h-[44px] px-3 text-sm text-zinc-400">Cancel</button>
        </div>
      )}
      {error && <p className="text-sm text-red-400" role="alert" id="step-up-error">{error}</p>}
    </div>
  );
}
