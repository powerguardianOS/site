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
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <form onSubmit={submit} className="w-80 space-y-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h1 className="text-white font-semibold text-base">Admin toegang</h1>
        <input
          type="password"
          placeholder="Admin token"
          value={token}
          onChange={e => setToken(e.target.value)}
          required
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          className="w-full bg-[#00C66F] text-black font-medium text-sm py-2 rounded-lg hover:bg-[#00b564] transition"
        >
          Inloggen
        </button>
      </form>
    </div>
  );
}
