'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import CheckInbox, { isInstalledApp } from './check-inbox'
import { passkeySupported, conditionalSupported, requestFromJson, credentialJson, postJson, saveHint, hasHint, hintOf } from '@/app/lib/webauthn-client'

// LOGIN-1: /login?error=link is where a used, expired or unknown sign-in link lands (app/api/auth/verify).
// CLOUD-MFA: error=timeout (the two-step page waited too long) and error=codes (too many wrong codes).
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
  return <LoginForm notice={Object.prototype.hasOwnProperty.call(NOTICES, e) ? NOTICES[e] : ''} />
}

// LOGIN-2: one request mails a link and a 6-digit code; "Check your inbox" takes the code and follows the link when it
// is opened in this browser (app/login/check-inbox.tsx). The installed home-screen app has its own cookie jar, so there
// the code is the way in.
// PASSKEYS-1 (B2): no second button. A passkey is offered (1) in the e-mail field's own suggestions (browser autofill,
// WebAuthn conditional mediation) and (2) right after Continue when this device used a passkey for that address before
// (a local hint, app/lib/webauthn-client.ts). A passkey signs in at once (it is both steps); closing its dialog sends
// the sign-in link as always.
type PasskeyResult = 'in' | 'unknown' | 'no'

function LoginForm({ notice }: { notice: string }) {
  const linkError = notice !== ''
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [pk, setPk] = useState(false)
  const condAbort = useRef<AbortController | null>(null)
  const [pkFor, setPkFor] = useState(false) // the typed address used a passkey on this device: the button says Continue
  useEffect(() => { setPk(passkeySupported()) }, [])
  useEffect(() => {
    let live = true
    if (pk) hasHint(email).then((h) => { if (live) setPkFor(h) }); else setPkFor(false)
    return () => { live = false }
  }, [pk, email])

  // A credential from the browser → the server. Signs in (and leaves the page) or says why not.
  // expect: the typed address's hint; a passkey of another account is then refused (the link goes to the typed one).
  const finishPasskey = useCallback(async (c: Credential | null, expect?: string): Promise<PasskeyResult> => {
    const credential = credentialJson(c)
    if (!credential) return 'no'
    const r = await postJson('/api/auth/passkey/verify', expect ? { credential, expect } : { credential })
    const next = r.data.next
    if (r.ok && typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
      saveHint(r.data.hint)
      window.location.assign(next)
      return 'in'
    }
    return r.data.error === 'unknown' ? 'unknown' : 'no'
  }, [])

  // Autofill: this site's passkeys in the e-mail field's suggestions, where the browser supports it.
  useEffect(() => {
    if (!pk || sent) return
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
        if (await finishPasskey(c) !== 'in' && !stop) setError('That passkey did not work. Try again, or send a sign-in link.')
      } catch { clearTimeout(timer) }
    }
    run()
    return () => { stop = true; clearTimeout(timer); condAbort.current?.abort() }
  }, [pk, sent, finishPasskey])

  // Continue with an address this device used a passkey for: the passkey dialog first. Signed in → true.
  const tryPasskey = async (): Promise<boolean> => {
    if (!pk || !(await hasHint(email))) return false // the hint is re-checked: the address may have just changed
    condAbort.current?.abort()
    try {
      const o = await postJson('/api/auth/passkey/options', {})
      if (!o.ok) return false
      const c = await navigator.credentials.get(requestFromJson(o.data.publicKey as Record<string, unknown>))
      const hint = await hintOf(email)
      const r = await finishPasskey(c, hint)
      if (r === 'unknown') saveHint(hint, false)
      return r === 'in'
    } catch {
      return false // closed or failed: the sign-in link below
    }
  }

  const ask = async (): Promise<number> => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, app: isInstalledApp() }),
    })
    return r.status
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (await tryPasskey()) return
      const status = await ask()
      if (status === 429) setError('Too many requests — try again later.')
      else if (status !== 200) setError('Something went wrong — try again.')
      else setSent(true)
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
          <h1 className="text-2xl font-semibold tracking-tight">Sign in or create account</h1>
          <p className="text-sm text-zinc-500">Enter your email to sign in or create a free account.</p>
        </div>

        {linkError && !sent && (
          <div id="link-expired" role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium text-amber-200">{notice}</p>
            <p className="mt-1 text-amber-100/70">Enter your email and we will send you a new one.</p>
          </div>
        )}

        {/* Form / Sent state */}
        {sent ? (
          <CheckInbox email={email} withCode={isInstalledApp()} onReset={() => { setSent(false); setError('') }} onResend={async () => (await ask().catch(() => 0)) === 200} />
        ) : (
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
              className="w-full bg-[#00C66F] text-black font-medium py-3 rounded-lg text-sm hover:bg-[#00b564] transition-colors disabled:opacity-50"
            >
              {loading ? (pkFor ? 'One moment…' : 'Sending…') : pkFor ? 'Continue' : 'Send sign-in link'}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>
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