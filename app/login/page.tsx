'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/auth/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!r.ok) {
        setError('Something went wrong — try again.')
      } else {
        setSent(true)
      }
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
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#00C66F]/10 border border-[#00C66F]/20 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C66F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to PowerGuardian</h1>
          <p className="text-sm text-zinc-500">Enter your email — we&apos;ll send you a sign-in link.</p>
        </div>

        {/* Form / Sent state */}
        {sent ? (
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
              placeholder="you@example.com"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00C66F] text-black font-medium py-3 rounded-lg text-sm hover:bg-[#00b564] transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>
        )}

        <p className="text-center text-xs text-zinc-600">
          No account yet?{' '}
          <Link href="/pricing" className="text-zinc-400 hover:text-white transition-colors">
            View plans
          </Link>
        </p>
      </div>
    </div>
  )
}
