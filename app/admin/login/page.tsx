'use client';
import { useState } from 'react';

export default function AdminLoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (r.ok) {
      window.location.href = '/admin';
    } else {
      setError('Invalid token');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 md:py-32">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00C66F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin access</h1>
          <p className="text-sm text-zinc-500">PowerGuardian internal portal</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={e => setToken(e.target.value)}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full bg-[#00C66F] text-black font-medium py-3 rounded-lg text-sm hover:bg-[#00b564] transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
