'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

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
  useEffect(() => { if (codeFirst || standalone()) setUseCode(true) }, [codeFirst])

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
        setCodeSent(true); setCode('')
      } else {
        setSent(true)
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
        {codeSent ? (
          <form onSubmit={handleCode} className="space-y-3" id="code-form">
            <p className="text-sm text-zinc-300">We sent a 6-digit code to <span className="text-white">{email}</span>. It works once, for 15 minutes.</p>
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
            <button type="button" onClick={() => { setCodeSent(false); setError('') }} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Send a new code or use a different email
            </button>
          </form>
        ) : sent ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 text-center space-y-3">
            <div className="text-2xl">📬</div>
            <p className="text-sm text-zinc-300 font-medium">Check your inbox</p>
            <p className="text-xs text-zinc-500">
              We sent a sign-in link to <span className="text-zinc-300">{email}</span>.
              <br />The link expires in 15 minutes.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
              {loading ? 'Sending…' : useCode ? 'Email me a 6-digit code' : 'Send sign-in link'}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="button" id="signin-mode" onClick={() => { setUseCode(!useCode); setError('') }}
              className="block w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2">
              {useCode ? 'Email me a sign-in link instead' : 'Email me a 6-digit code instead'}
            </button>
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