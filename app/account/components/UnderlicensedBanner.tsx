'use client';

import Link from 'next/link';

interface Props {
  connectorCount?: number;
  connectorLimit: number;
}

export default function UnderlicensedBanner({ connectorCount = 0, connectorLimit }: Props) {
  if (connectorCount <= connectorLimit) return null;

  const over = connectorCount - connectorLimit;

  return (
    <div className="bg-red-600/90 text-white rounded-lg p-3 flex items-center justify-between text-sm">
      <span>
        Your site is underlicensed — {over} connector{over > 1 ? 's' : ''} over limit.
        New connectors are blocked until you purchase add-on licenses.
      </span>
      <Link
        href="/pricing"
        className="ml-4 shrink-0 underline font-medium hover:text-white/80"
      >
        Buy add-on
      </Link>
    </div>
  );
}
