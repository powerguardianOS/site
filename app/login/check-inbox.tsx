'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// LOGIN-2: "Check your inbox", after a sign-in was asked for (app/lib/signin-code.ts). Two ways in, both for this
// browser only:
//   - the link opened in this same browser signs in there; this tab notices (poll /api/auth/status every 2 s, plus a
//     BroadcastChannel nudge from the link's page) and goes on via /api/auth/continue;
//   - the 6-digit code from the same mail, typed here (the installed home-screen app, or the link opened on a phone).
// Stops after 15 minutes; pauses while the tab has been hidden for a while (and checks again when it is shown).
const TTL_MS = 15 * 60_000
const POLL_MS = 2000
const HIDDEN_PAUSE_MS = 2 * 60_000

export default function CheckInbox({ email, onReset, onResend }: { email: string; onReset: () => void; onResend: () => Promise<boolean> }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dead, setDead] = useState(false)
  const [resending, setResending] = useState(false)
  const started = useRef(Date.now())
  const leaving = useRef(false)

  const go = useCallback((to: string) => { if (!leaving.current) { leaving.current = true; window.location.assign(to) } }, [])

  const poll = useCallback(async () => {
    if (leaving.current) return
    if (Date.now() - started.current > TTL_MS) { setDead(true); return }
    try {
      const r = await fetch('/api/auth/status', { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (d.state === 'done') go('/api/auth/continue')
      else if (d.state === 'expired') setDead(true)
    } catch { /* offline for a moment: next tick */ }
  }, [go])

  useEffect(() => {
    if (dead) return
    let hiddenSince = document.hidden ? Date.now() : 0
    const t = setInterval(() => {
      if (hiddenSince && Date.now() - hiddenSince > HIDDEN_PAUSE_MS) return
      poll()
    }, POLL_MS)
    const vis = () => { if (document.hidden) hiddenSince = Date.now(); else { hiddenSince = 0; poll() } }
    document.addEventListener('visibilitychange', vis)
    let bc: BroadcastChannel | null = null
    try { bc = new BroadcastChannel('pg-login'); bc.onmessage = () => poll() } catch { /* older browser: polling only */ }
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); bc?.close() }
  }, [dead, poll])

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/auth/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok && typeof d.next === 'string' && d.next.startsWith('/') && !d.next.startsWith('//')) { go(d.next); return }
      if (d.error === 'wrong' && d.left > 0) setError(`That code is not right — ${d.left} ${d.left === 1 ? 'try' : 'tries'} left.`)
      else if (d.error === 'wrong' || d.error === 'expired') setDead(true)
      else setError('Something went wrong — try again.')
    } catch {
      setError('Something went wrong — try again.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    setResending(true)
    setError('')
    const ok = await onResend()
    setResending(false)
    if (ok) { started.current = Date.now(); setCode(''); setDead(false) }
    else setError('Could not send a new link — try again later.')
  }

  if (dead) {
    return (
      <div id="signin-dead" className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 text-center space-y-3">
        <p className="text-sm text-zinc-300 font-medium">This sign-in has expired</p>
        <p className="text-xs text-zinc-500">It was used, timed out, or had too many wrong codes.</p>
        <button type="button" id="signin-new-link" onClick={resend} disabled={resending}
          className="w-full bg-[#00C66F] text-black font-medium py-3 rounded-lg text-base hover:bg-[#00b564] transition-colors disabled:opacity-50">
          {resending ? 'Sending…' : 'Request a new link'}
        </button>
        {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
        <button type="button" onClick={onReset} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Use a different email</button>
      </div>
    )
  }

  return (
    <div id="check-inbox" className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
      <div className="text-center space-y-1">
        <p className="text-sm text-zinc-300 font-medium">Check your inbox</p>
        <p className="text-xs text-zinc-500">
          We sent a sign-in link and a 6-digit code to <span className="text-zinc-300">{email}</span>.
          <br />Open the link here and this page continues by itself.
        </p>
      </div>
      <form onSubmit={handleCode} className="space-y-3" id="code-form">
        <input
          id="signin-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          placeholder="Code from the email"
          aria-label="6-digit code"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-base tracking-[0.3em] placeholder:tracking-normal text-center text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
        />
        <button type="submit" id="signin-code-submit" disabled={loading || code.length !== 6}
          className="w-full bg-[#00C66F] text-black font-medium py-3 rounded-lg text-base hover:bg-[#00b564] transition-colors disabled:opacity-50">
          {loading ? 'Checking…' : 'Sign in'}
        </button>
        {error && <p className="text-xs text-red-400" role="alert" id="signin-code-error">{error}</p>}
      </form>
      <p className="text-center text-xs text-zinc-600">
        Expires in 15 minutes.{' '}
        <button type="button" onClick={onReset} className="text-zinc-500 hover:text-zinc-300 transition-colors">Use a different email</button>
      </p>
    </div>
  )
}
