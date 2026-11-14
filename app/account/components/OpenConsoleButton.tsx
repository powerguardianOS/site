'use client';

import { useState } from 'react';

interface Props {
  licenseId: string;
  name: string;
}

// Replaces the old direct link to the relay with the controller's raw,
// permanent license token baked into the URL. Instead this mints a
// short-lived scoped session server-side (see /api/account/relay-session)
// and opens that — the long-lived token never reaches the browser.
//
// ACCOUNT-UI: the whole site tile is the click target (a transparent button over the tile); the small "Open ↗" in the
// tile's corner is its visible affordance. Place it inside a `relative` tile.
export default function OpenConsoleButton({ licenseId, name }: Props) {
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
    <>
      <button onClick={openConsole} disabled={loading} aria-label={`Open Console · ${name}`}
        className="open-console absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#00C66F] disabled:cursor-wait" />
      <span aria-hidden="true" className={`open-affordance pointer-events-none absolute right-4 top-4 rounded-md px-1.5 py-0.5 text-xs font-medium ${error ? 'text-red-400' : 'text-[#00C66F] bg-[#00C66F]/10'}`}>
        {loading ? 'Opening…' : error ? 'Try again' : 'Open ↗'}
      </span>
      {error && <span role="alert" className="sr-only">Could not open the console: {error}</span>}
    </>
  );
}
