'use client'

import { useState } from 'react'

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
        headers: {
          'Content-Type': 'application/json',
        },
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-2">Sign in</h1>
        <p className="text-sm text-white/50 mb-8">Enter your email to receive a sign-in link.</p>

        {sent ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-sm text-white/70">Check your email — we sent a sign-in link to {email}.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 mb-4"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-medium py-3 rounded-lg text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send sign-in link'}
            </button>
            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
