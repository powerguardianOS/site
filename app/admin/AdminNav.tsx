'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICON: Record<string, string> = {
  overview: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  tenants: 'M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16 M14 9h5a1 1 0 0 1 1 1v11 M8 8h2 M8 12h2 M8 16h2 M3 21h18',
  fleet: 'M3 4h18v6H3z M3 14h18v6H3z M7 7h.01 M7 17h.01',
  alerts: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8 M10 20a2 2 0 0 0 4 0',
  billing: 'M3 6h18v12H3z M3 10h18',
  support: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  audit: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
};

type Item = { label: string; icon: keyof typeof ICON; href?: string };
const GROUPS: { label: string; items: Item[] }[] = [
  { label: 'Operate', items: [
    { label: 'Overview', icon: 'overview', href: '/admin' },
    { label: 'Tenants', icon: 'tenants', href: '/admin/tenants' },
    { label: 'Fleet', icon: 'fleet' },
    { label: 'Alerts', icon: 'alerts' },
  ]},
  { label: 'Commerce', items: [{ label: 'Billing', icon: 'billing' }] },
  { label: 'Trust', items: [
    { label: 'Support access', icon: 'support' },
    { label: 'Audit log', icon: 'audit' },
  ]},
];

export default function AdminNav() {
  const path = usePathname() ?? '';
  const active = (href: string) =>
    href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/') || (href === '/admin/tenants' && path.startsWith('/admin/customers'));

  return (
    <nav aria-label="Admin" className="flex flex-row gap-2 md:flex-col md:gap-5">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex flex-row gap-1 md:flex-col md:gap-0.5">
          <div className="hidden px-2 pb-1.5 text-[11px] uppercase tracking-[0.12em] text-zinc-500 md:block">{g.label}</div>
          {g.items.map((n) => {
            const on = n.href ? active(n.href) : false;
            const cls = `items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${n.href ? 'flex' : 'hidden md:flex'} ${
              on ? 'bg-[#17201b] text-[#00C66F]' : n.href ? 'text-zinc-300 hover:bg-zinc-900' : 'cursor-not-allowed text-zinc-600'
            }`;
            const inner = (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={ICON[n.icon]} />
                </svg>
                <span className="flex-1">{n.label}</span>
                {!n.href && <span className="rounded border border-zinc-800 px-1.5 text-[10px] text-zinc-600">soon</span>}
              </>
            );
            return n.href ? (
              <Link key={n.label} href={n.href} className={cls} aria-current={on ? 'page' : undefined}>{inner}</Link>
            ) : (
              <div key={n.label} className={cls} aria-disabled="true">{inner}</div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
