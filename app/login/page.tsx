'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  passkeySupported, conditionalSupported, requestFromJson, credentialJson, cancelled, postJson,
  readRemembered, writeRemembered, type Remembered,
} from '@/app/lib/webauthn-client'

// LOGIN-1: /login?error=link is where a used, expired or unknown sign-in link lands (app/api/auth/verify).
// CLOUD-MFA: error=timeout (the two-step page waited too long) and error=codes (too many wrong codes).
// PASSKEYS-1: "Sign in with a passkey" is the first choice wherever the browser has passkeys (also in the installed
// home-screen app), plus autofill on the e-mail field (conditional UI). A browser that signed in before shows
// "Continue as r***@gmail.com" (app/lib/remember.ts). The e-mail link / 6-digit code stays below as the fallback.
const NOTICES: Record<string, string> = {
  link: 'This sign-in link has expired or was already used.',
  timeout: 'Your sign-in took too long.',
  codes: 'Too many wrong codes.',
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginForm notice="" />}>
      <LoginWithParams />
    </Suspense>
  )
}

function LoginWithParams() {
  const params = useSearchParams()
  const e = params.get('error') ?? ''
  // a controller's sign-in (next=sso) or site switch (next=console) usually runs inside an app: the code first
  const next = params.get('next') ?? ''
  return <LoginForm notice={Object.prototype.hasOwnProperty.call(NOTICES, e) ? NOTICES[e] : ''} codeFirst={next === 'sso' || next === 'console'} />
}

// The installed home-screen app has its own cookie jar: a link from the mail opens in Safari or Gmail, not in the app.
// There the 6-digit code from the same mail is the way in (app/lib/signin-code.ts).
function standalone(): boolean {
  if (typeof window === 'undefined') return false
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

function LoginForm({ notice, codeFirst = false }: { notice: string; codeFirst?: boolean }) {
  const linkError = notice !== ''
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [useCode, setUseCode] = useState(codeFirst)
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sentTo, setSentTo] = useState('')        // the masked address when sent for the remembered account
  const [pk, setPk] = useState(false)             // this browser has passkeys
  const [pkBusy, setPkBusy] = useState(false)
  const [pkError, setPkError] = useState('')
  const [remembered, setRemembered] = useState<Remembered | null>(null)
  const [other, setOther] = useState(false)       // "Use another account"
  const [condRun, setCondRun] = useState(0)       // restarts the autofill request after a modal one
  const condAbort = useRef<AbortController | null>(null)
  useEffect(() => { if (codeFirst || standalone()) setUseCode(true) }, [codeFirst])
  useEffect(() => { setPk(passkeySupported()); setRemembered(readRemembered()) }, [])

  const finishPasskey = useCallback(async (c: Credential | null) => {
    const credential = credentialJson(c)
    if (!credential) return
    const r = await postJson('/api/auth/passkey/verify', { credential })
    const next = r.data.next
    if (r.ok && typeof next === 'string' && next.startsWith('/')) { window.location.assign(next); return }
    setPkError(r.data.error === 'unknown' ? 'This passkey is not on a PowerGuardian account any more. Use your email below.'
      : r.data.error === 'expired' ? 'That took too long. Try again.'
      : r.status === 429 ? 'Too many tries. Wait a few minutes, or use your email.'
      : 'That passkey did not work. Try again, or use your email.')
  }, [])

  // Autofill: passkeys offered right in the e-mail field's suggestions, where the browser supports it.
  const showForm = !sent && !codeSent && (!remembered || other)
  useEffect(() => {
    if (!pk || !showForm) return
    let stop = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = async () => {
      if (stop || !(await conditionalSupported())) return
      const o = await postJson('/api/auth/passkey/options', {})
      if (stop || !o.ok) return
      const ac = new AbortController(); condAbort.current = ac
      timer = setTimeout(() => { ac.abort(); run() }, 110_000) // a fresh challenge before this one expires
      try {
        const c = await navigator.credentials.get(requestFromJson(o.data.publicKey as Record<string, unknown>, { mediation: 'conditional', signal: ac.signal }))
        clearTimeout(timer)
        await finishPasskey(c)
      } catch { clearTimeout(timer) }
    }
    run()
    return () => { stop = true; clearTimeout(timer); condAbort.current?.abort() }
  }, [pk, showForm, condRun, finishPasskey])

  const signInWithPasskey = async () => {
    condAbort.current?.abort()
    setPkBusy(true); setPkError(''); setError('')
    try {
      const o = await postJson('/api/auth/passkey/options', {})
      if (!o.ok) { setPkError(o.status === 429 ? 'Too many tries. Wait a few minutes, or use your email.' : 'Something went wrong. Try again.'); return }
      const c = await navigator.credentials.get(requestFromJson(o.data.publicKey as Record<string, unknown>))
      await finishPasskey(c)
    } catch (e) {
      if (!cancelled(e)) setPkError('That passkey did not work. Try again, or use your email.')
    } finally {
      setPkBusy(false); setCondRun((n) => n + 1)
    }
  }

  // The remembered account without a passkey (or the passkey dialog was closed): mail a link / code to it.
  const continueByMail = async () => {
    if (!remembered) return
    setLoading(true); setError(''); setPkError('')
    const r = await postJson('/api/auth/register', useCode ? { handle: remembered.handle, code: true } : { handle: remembered.handle })
    setLoading(false)
    if (r.status === 404) { writeRemembered(null); setRemembered(null); setError('This device no longer remembers that account. Enter your email.'); return }
    if (r.status === 429) { setError('Too many requests — try again later.'); return }
    if (!r.ok) { setError('Something went wrong — try again.'); return }
    setSentTo(remembered.masked)
    if (useCode) { setCodeSent(true); setCode('') } else setSent(true)
  }

  const forget = async () => {
    const h = remembered?.handle
    writeRemembered(null); setRemembered(null); setOther(false); setPkError(''); setError('')
    if (h) await postJson('/api/auth/remembered', { action: 'forget', handle: h })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useCode ? { email, code: true } : { email }),
      })
      if (r.status === 429) {
        setError('Too many requests — try again later.')
      } else if (!r.ok) {
        setError('Something went wrong — try again.')
      } else if (useCode) {
        setSentTo(''); setCodeSent(true); setCode('')
      } else {
        setSentTo(''); setSent(true)
      }
    } catch {
      setError('Something went wrong — try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/auth/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok && typeof d.next === 'string' && d.next.startsWith('/')) { window.location.assign(d.next); return }
      if (d.error === 'wrong') setError(`That code is not right${d.left > 0 ? ` — ${d.left} ${d.left === 1 ? 'try' : 'tries'} left` : ''}.`)
      else { setError('This code has expired or was used. Ask for a new one.'); setCodeSent(false) }
    } catch {
      setError('Something went wrong — try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 md:py-32">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand hint */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00C66F]/10 border border-[#00C66F]/20 mb-3">
            <svg width="28" height="32" viewBox="0 0 128 140" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M64 8 L112 28 V72 C112 100 94 122 64 132 C34 122 16 100 16 72 V28 L64 8Z" fill="none" stroke="#00C66F" strokeWidth="10" strokeLinejoin="round"/>
              <path d="M72 32 L48 72 H62 L52 108 L80 68 H66 L72 32Z" fill="#00C66F"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{remembered && !other ? 'Welcome back' : 'Sign in or create account'}</h1>
          {!(remembered && !other) && <p className="text-sm text-zinc-500">{pk ? 'Use a passkey, or your email to sign in or create a free account.' : 'Enter your email to sign in or create a free account.'}</p>}
        </div>

        {linkError && !sent && (
          <div id="link-expired" role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium text-amber-200">{notice}</p>
            <p className="mt-1 text-amber-100/70">Enter your email and we will send you a new one.</p>
          </div>
        )}

        {/* Form / Sent state */}
        {codeSent ? (
          <form onSubmit={handleCode} className="space-y-3" id="code-form">
            <p className="text-sm text-zinc-300">We sent a 6-digit code to <span className="text-white">{sentTo || email}</span>. It works once, for 15 minutes.</p>
            <input
              id="signin-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              placeholder="123456"
              aria-label="6-digit code"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-base tracking-[0.3em] text-center text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
            <button type="submit" id="signin-code-submit" disabled={loading || code.length !== 6}
              className="w-full bg-[#00C66F] text-black font-medium py-3 rounded-lg text-base hover:bg-[#00b564] transition-colors disabled:opacity-50">
              {loading ? 'Checking…' : 'Sign in'}
            </button>
            {error && <p className="text-xs text-red-400" role="alert" id="signin-code-error">{error}</p>}
            <button type="button" onClick={() => { setCodeSent(false); setError(''); if (sentTo) setOther(true); setSentTo('') }} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Send a new code or use a different email
            </button>
          </form>
        ) : sent ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 text-center space-y-3">
            <div className="text-2xl">📬</div>
            <p className="text-sm text-zinc-300 font-medium">Check your inbox</p>
            <p className="text-xs text-zinc-500">
              We sent a sign-in link to <span className="text-zinc-300">{sentTo || email}</span>.
              <br />The link expires in 15 minutes.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); if (sentTo) setOther(true); setSentTo('') }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-2"
            >
              Use a different email
            </button>
          </div>
        ) : remembered && !other ? (
          <div id="remembered" className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00C66F]/15 text-lg font-semibold uppercase text-[#00C66F]">{remembered.masked.slice(0, 1)}</span>
              <div className="min-w-0">
                <p id="remembered-email" className="truncate text-base text-white">{remembered.masked}</p>
                <p className="text-xs text-zinc-500">{remembered.passkey && pk ? 'Sign in with your passkey' : 'Signed in on this device before'}</p>
              </div>
            </div>
            <button type="button" id="remembered-continue" disabled={pkBusy || loading}
              onClick={() => (remembered.passkey && pk ? signInWithPasskey() : continueByMail())}
              className="w-full min-h-[48px] bg-[#00C66F] text-black font-medium py-3 rounded-lg text-base hover:bg-[#00b564] transition-colors disabled:opacity-50">
              {pkBusy || loading ? 'One moment…' : `Continue as ${remembered.masked}`}
            </button>
            {(pkError || error) && <p className="text-xs text-red-400" role="alert" id="remembered-error">{pkError || error}</p>}
            {remembered.passkey && pk && (
              <button type="button" id="remembered-mail" onClick={continueByMail} disabled={loading}
                className="block w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1">
                {useCode ? 'Email me a 6-digit code instead' : 'Email me a sign-in link instead'}
              </button>
            )}
            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3 text-sm">
              <button type="button" id="remembered-other" onClick={() => { setOther(true); setPkError(''); setError('') }}
                className="min-h-[44px] text-zinc-300 hover:text-white transition-colors">Use another account</button>
              <button type="button" id="remembered-forget" onClick={forget}
                className="min-h-[44px] text-zinc-500 hover:text-red-300 transition-colors">Forget</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
          {pk && (
            <div className="space-y-2">
              <button type="button" id="passkey-signin" onClick={signInWithPasskey} disabled={pkBusy}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 bg-[#00C66F] text-black font-medium py-3 rounded-lg text-base hover:bg-[#00b564] transition-colors disabled:opacity-50">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 9.5-4.9"/><circle cx="18" cy="13" r="2.5"/><path d="M18 15.5V21l1.5-1.2M18 18.5h1.5"/></svg>
                {pkBusy ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
              </button>
              {pkError && <p className="text-xs text-red-400" role="alert" id="passkey-error">{pkError}</p>}
              <div className="flex items-center gap-3 pt-2 text-xs text-zinc-600" aria-hidden="true">
                <span className="h-px flex-1 bg-zinc-800" />or use your email<span className="h-px flex-1 bg-zinc-800" />
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete={pk ? 'username webauthn' : 'email'}
              inputMode="email"
              autoFocus={linkError}
              placeholder="you@example.com"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-base text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className={pk
                ? 'w-full min-h-[48px] border border-zinc-700 text-zinc-100 font-medium py-3 rounded-lg text-sm hover:border-zinc-500 transition-colors disabled:opacity-50'
                : 'w-full bg-[#00C66F] text-black font-medium py-3 rounded-lg text-sm hover:bg-[#00b564] transition-colors disabled:opacity-50'}
            >
              {loading ? 'Sending…' : useCode ? 'Email me a 6-digit code' : 'Send sign-in link'}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="button" id="signin-mode" onClick={() => { setUseCode(!useCode); setError('') }}
              className="block w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2">
              {useCode ? 'Email me a sign-in link instead' : 'Email me a 6-digit code instead'}
            </button>
          </form>
          {remembered && other && (
            <button type="button" id="remembered-back" onClick={() => { setOther(false); setError('') }}
              className="block w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Continue as {remembered.masked} instead
            </button>
          )}
          </div>
        )}

        <p className="text-center text-xs text-zinc-600">
          No account yet?{' '}
          <Link href="/register" className="text-zinc-400 hover:text-white transition-colors">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}