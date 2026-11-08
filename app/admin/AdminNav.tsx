'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICON: Record<string, string> = {
  overview: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  customers: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  licenses: 'M15 7a2 2 0 0 1 2 2 M21 9a6 6 0 0 1-7.74 5.74L11 17H9v2H7v2H3v-4l6.26-6.26A6 6 0 1 1 21 9z',
  fleet: 'M3 4h18v6H3z M3 14h18v6H3z M7 7h.01 M7 17h.01',
  alerts: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8 M10 20a2 2 0 0 0 4 0',
  billing: 'M3 6h18v12H3z M3 10h18',
  support: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  audit: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
};

type Item = { label: string; short?: string; icon: keyof typeof ICON; href?: string };
const GROUPS: { label: string; items: Item[] }[] = [
  { label: 'Operate', items: [
    { label: 'Overview', icon: 'overview', href: '/admin' },
    { label: 'Customers', icon: 'customers', href: '/admin/tenants' },
    { label: 'Licenses', icon: 'licenses', href: '/admin/licenses' },
    { label: 'Fleet', icon: 'fleet' },
    { label: 'Alerts', icon: 'alerts' },
  ]},
  { label: 'Commerce', items: [{ label: 'Billing', icon: 'billing' }] },
  { label: 'Trust', items: [
    { label: 'Support access', icon: 'support' },
    { label: 'Audit log', short: 'Audit', icon: 'audit', href: '/admin/audit' },
  ]},
];
const LIVE = GROUPS.flatMap((g) => g.items).filter((i) => i.href);

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[name]} />
    </svg>
  );
}

export default function AdminNav() {
  const path = usePathname() ?? '';
  const active = (href: string) => {
    if (href === '/admin') return path === '/admin';
    if (href === '/admin/tenants') return path.startsWith('/admin/tenants') || path.startsWith('/admin/customers');
    if (href === '/admin/licenses') return path === '/admin/licenses' || path.startsWith('/admin/licenses/');
    return path === href || path.startsWith(href + '/');
  };

  return (
    <>
      {/* Desktop: grouped sidebar, with what is coming greyed out. */}
      <nav aria-label="Admin" className="hidden flex-col gap-5 md:flex">
        {GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            <div className="px-2 pb-1.5 text-[11px] uppercase tracking-[0.12em] text-zinc-500">{g.label}</div>
            {g.items.map((n) => {
              const on = n.href ? active(n.href) : false;
              const cls = `flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${
                on ? 'bg-[#17201b] text-[#00C66F]' : n.href ? 'text-zinc-300 hover:bg-zinc-900' : 'cursor-not-allowed text-zinc-600'
              }`;
              const inner = (
                <>
                  <Icon name={n.icon} />
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

      {/* Phone: a tab bar at the bottom, in thumb reach. Only what works today. */}
      <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-[#060a14]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {LIVE.map((n) => {
            const on = active(n.href!);
            return (
              <Link key={n.label} href={n.href!} aria-current={on ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${on ? 'text-[#00C66F]' : 'text-zinc-400'}`}>
                <Icon name={n.icon} size={20} />
                <span>{n.short ?? n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
