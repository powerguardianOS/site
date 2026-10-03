'use client';

import { useState } from 'react';

interface Props {
  licenseId: string;
}

// Replaces the old direct link to the relay with the controller's raw,
// permanent license token baked into the URL. Instead this mints a
// short-lived scoped session server-side (see /api/account/relay-session)
// and opens that — the long-lived token never reaches the browser.
export default function OpenConsoleButton({ licenseId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openConsole() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/relay-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_id: licenseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not open console');
        return;
      }
      window.open(data.console_url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={openConsole}
        disabled={loading}
        className="text-[#00C66F] hover:underline disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? 'Opening…' : 'Open Console →'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
