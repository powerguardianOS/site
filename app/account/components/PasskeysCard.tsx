'use client';

// PASSKEYS-1: passkeys on the account page.
//   PasskeysCard  — the single place for passkeys (B2: no separate "add a passkey" banner): the quiet "Passkeys" line under Two-step sign-in; opens a list (name, added, last used, synced),
//                   "Add a passkey", and Remove with a fresh confirmation (a passkey, or an authenticator/recovery code).
// B2: adding a passkey here also tells this device's /login to offer it for this address (saveHint).
// Everything happens inline (no modal, no toast). Changes tell the Two-step card through the 'pg:twostep' event.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  passkeySupported, creationFromJson, requestFromJson, credentialJson, deviceLabel, cancelled, postJson,
  saveHint,
} from '@/app/lib/webauthn-client';

export type PasskeyItem = { id: string; name: string; created_at: string; last_used_at: string | null; synced: boolean };

const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
function ago(s: string | null): string {
  if (!s) return 'not used yet';
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 2) return 'used just now';
  if (m < 90) return `used ${m} min ago`;
  if (m < 36 * 60) return `used ${Math.round(m / 60)} h ago`;
  return `used ${fmtDate(s)}`;
}
const noop = () => () => {};
const changed = () => window.dispatchEvent(new Event('pg:twostep'));

// navigator.credentials.create → the server. Returns the recovery codes when this passkey turned two-step on.
async function addPasskey(): Promise<{ ok: true; codes: string[] } | { ok: false; message: string }> {
  const o = await postJson('/api/account/passkeys', { action: 'options' });
  if (!o.ok) return { ok: false, message: String(o.data.message ?? 'Something went wrong. Try again.') };
  let c: Credential | null;
  try {
    c = await navigator.credentials.create(creationFromJson(o.data.publicKey as Record<string, unknown>));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'InvalidStateError') return { ok: false, message: 'This device already has a passkey for your account.' };
    return { ok: false, message: cancelled(e) ? '' : 'The passkey could not be made. Try again.' };
  }
  const r = await postJson('/api/account/passkeys', { action: 'register', credential: credentialJson(c), device: deviceLabel() });
  if (!r.ok) return { ok: false, message: String(r.data.message ?? 'The passkey could not be added. Try again.') };
  changed();
  saveHint(r.data.hint);
  return { ok: true, codes: (r.data.recovery_codes as string[] | null) ?? [] };
}

// A fresh confirmation with one of this account's passkeys (the browser offers only those).
export async function confirmWithPasskey(): Promise<Record<string, unknown> | null> {
  const o = await postJson('/api/account/passkeys', { action: 'confirm-options' });
  if (!o.ok) return null;
  const c = await navigator.credentials.get(requestFromJson(o.data.publicKey as Record<string, unknown>));
  return credentialJson(c);
}

export function RecoveryCodes({ codes, onDone, intro }: { codes: string[]; onDone: () => void; intro?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/70">{intro ?? 'Save these recovery codes somewhere safe, like a password manager. Each one lets you sign in once if you lose your passkey or phone. They are shown only now.'}</p>
      <ol id="passkey-codes" className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-white list-decimal list-inside select-all">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ol>
      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={async () => { try { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true); } catch { setCopied(false); } }}
          className="min-h-[44px] px-4 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-200">{copied ? 'Copied' : 'Copy codes'}</button>
        <button id="passkey-codes-done" onClick={onDone} className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-medium">I saved them</button>
      </div>
    </div>
  );
}

const KeyIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 9.5-4.9"/><circle cx="18" cy="13" r="2.5"/><path d="M18 15.5V21l1.5-1.2M18 18.5h1.5"/></svg>
);

export default function PasskeysCard({ initial, totp, required }: { initial: PasskeyItem[]; totp: boolean; required: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<PasskeyItem[]>(initial);
  const [hasTotp, setHasTotp] = useState(totp);
  const supported = useSyncExternalStore(noop, passkeySupported, () => true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/account/passkeys').catch(() => null);
    if (r?.ok) { const d = await r.json(); setItems(d.passkeys ?? []); setHasTotp(d.totp === true); }
  }, []);
  useEffect(() => {
    const on = () => { load(); };
    window.addEventListener('pg:twostep', on);
    return () => window.removeEventListener('pg:twostep', on);
  }, [load]);

  const add = async () => {
    setBusy(true); setError('');
    const r = await addPasskey();
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    if (r.codes.length) setCodes(r.codes);
  };

  const remove = async (id: string, how: 'passkey' | 'code') => {
    setBusy(true); setError('');
    let body: Record<string, unknown> = { action: 'remove', id, code };
    if (how === 'passkey') {
      try {
        const credential = await confirmWithPasskey();
        if (!credential) { setBusy(false); setError('Could not start the confirmation. Try again.'); return; }
        body = { action: 'remove', id, credential };
      } catch (e) {
        setBusy(false); if (!cancelled(e)) setError('That passkey did not work. Try again.'); return;
      }
    }
    const r = await postJson('/api/account/passkeys', body);
    setBusy(false);
    if (!r.ok) { setError(String(r.data.message ?? 'Something went wrong. Try again.')); return; }
    setRemoving(null); setCode('');
    if (r.data.left === 0) saveHint(r.data.hint, false);
    changed();
  };

  const n = items.length;
  const last = n === 1 && !hasTotp;
  return (
    <section id="passkeys" className="text-sm">
      <p className="text-white/50">
        Passkeys:{' '}
        <span id="passkeys-state" className={n ? 'text-green-400' : 'text-white/70'}>{n === 0 ? 'None' : n}</span>
        {' · '}
        <button id="passkeys-manage" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); setRemoving(null); setError(''); }}
          className="inline-flex min-h-[44px] items-center text-[#00C66F] hover:underline sm:min-h-0">
          {expanded ? 'Close' : n ? 'Manage' : 'Add'}
        </button>
      </p>

      {expanded && (
        <div className="mt-2 space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
          {codes ? (
            <RecoveryCodes codes={codes} onDone={() => setCodes(null)} intro="Your passkey is added and two-step sign-in is on. Save these recovery codes somewhere safe, like a password manager: each one lets you sign in once if you lose your passkey. They are shown only now." />
          ) : (
            <>
              <p className="text-sm text-white/50">
                {n ? 'Sign in with Face ID, Touch ID, Windows Hello or your phone — no email needed. A passkey also counts as two-step sign-in.'
                  : 'A passkey signs you in with Face ID, Touch ID, Windows Hello or your phone — no email needed.'}
              </p>
              {n === 0 && !hasTotp && (
                <p className="text-sm text-white/60">Adding a passkey also turns on two-step sign-in. You get 10 recovery codes for when you lose it.</p>
              )}

              {n > 0 && (
                <ul id="passkeys-list" className="divide-y divide-white/[0.06] rounded-xl border border-white/10">
                  {items.map((p) => (
                    <li key={p.id} className="p-4 space-y-3" data-passkey={p.name}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/70"><KeyIcon /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white">{p.name}{p.synced && <span className="ml-2 rounded border border-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/50 align-middle">Synced</span>}</p>
                          <p className="text-xs text-white/45">Added {fmtDate(p.created_at)} · {ago(p.last_used_at)}</p>
                        </div>
                        {removing !== p.id && (
                          <button onClick={() => { setRemoving(p.id); setError(''); setCode(''); }} data-remove={p.id}
                            className="min-h-[44px] sm:min-h-[36px] px-3 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:border-red-500/60 hover:text-red-300">Remove</button>
                        )}
                      </div>
                      {removing === p.id && (
                        <div className="space-y-3 rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3" id="passkey-remove">
                          <p className="text-sm text-white/70">
                            Confirm it is you to remove “{p.name}”.
                            {last && (required ? ' This is your only second step: because your account manages sites, you will be asked to set one up again at your next sign-in.' : ' This is your only second step: two-step sign-in turns off and your recovery codes stop working.')}
                          </p>
                          {supported && (
                            <button id="passkey-remove-passkey" onClick={() => remove(p.id, 'passkey')} disabled={busy}
                              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-red-500/90 text-white text-sm font-medium disabled:opacity-50">
                              {busy ? 'Checking…' : 'Confirm with a passkey and remove'}
                            </button>
                          )}
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input id="passkey-remove-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="text" autoComplete="one-time-code"
                              placeholder={hasTotp ? 'Code from your app, or a recovery code' : 'A recovery code'}
                              className="flex-1 min-h-[44px] bg-zinc-950 border border-zinc-800 rounded-lg px-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00C66F]" />
                            <button id="passkey-remove-go" onClick={() => remove(p.id, 'code')} disabled={busy || code.trim() === ''}
                              className="min-h-[44px] px-4 rounded-lg border border-red-500/50 text-sm text-red-200 disabled:opacity-40">Remove with code</button>
                            <button onClick={() => { setRemoving(null); setError(''); }} className="min-h-[44px] px-3 text-sm text-zinc-400">Cancel</button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {error && <p className="text-sm text-red-400" role="alert" id="passkeys-error">{error}</p>}
              {supported ? (
                <button id="passkey-add" onClick={add} disabled={busy}
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] disabled:opacity-50">
                  <KeyIcon />{busy && !removing ? 'Waiting for your passkey…' : n ? 'Add another passkey' : 'Add a passkey'}
                </button>
              ) : (
                <p className="text-sm text-white/50">This browser cannot make passkeys. Open your account in Safari, Chrome, Edge or Firefox on a recent device.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
