// Shared building blocks of the admin console: one look for status, cards,
// buttons and page headers, so every page reads the same way. No client code.
import Link from 'next/link';
import type { ReactNode } from 'react';

export type Tone = 'ok' | 'warn' | 'bad' | 'idle' | 'off';

// Colour plus shape, so a status never depends on colour alone.
const DOT: Record<Tone, string> = {
  ok: 'bg-[#00C66F] rounded-full',
  warn: 'bg-amber-400 rounded-[2px]',
  bad: 'bg-red-400 rounded-[2px] rotate-45',
  idle: 'bg-zinc-500 rounded-full',
  off: 'bg-zinc-600 rounded-none',
};
export const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-[#3ddc97]',
  warn: 'text-amber-300',
  bad: 'text-red-300',
  idle: 'text-zinc-400',
  off: 'text-zinc-500',
};

export function Dot({ tone, className = '' }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 ${DOT[tone]} ${className}`} />;
}

export function Status({ tone, children, className = '' }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${TONE_TEXT[tone]} ${className}`}>
      <Dot tone={tone} />
      <span>{children}</span>
    </span>
  );
}

// Tap targets: 44 px on a phone, compact from `sm` up.
export const BTN = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:text-[13px]';
export const BTN_PRIMARY = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[#00C66F] px-3.5 text-sm font-medium text-black transition-colors hover:bg-[#00b564] sm:h-9 sm:text-[13px]';
export const BTN_DANGER = `${BTN} !border-red-900/70 !text-red-300 hover:!bg-red-950/40`;
export const CARD = 'rounded-xl border border-zinc-800/80 bg-zinc-950/60';

export function PageHeader({ title, sub, back, actions }: { title: ReactNode; sub?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <div className="space-y-3">
      {back && (
        <Link href={back.href} className="-ml-1 inline-flex h-11 items-center gap-1 px-1 text-sm text-zinc-400 hover:text-white sm:h-auto sm:text-xs">
          <span aria-hidden="true">‹</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-[22px] font-semibold leading-tight text-white sm:text-2xl">{title}</h1>
          {sub && <p className="mt-1 text-sm text-zinc-400">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Kpi({ label, value, sub, tone, href }: { label: string; value: ReactNode; sub: ReactNode; tone?: Tone; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      <p className={`mt-0.5 text-xs ${tone ? TONE_TEXT[tone] : 'text-zinc-500'}`}>{sub}</p>
    </>
  );
  const cls = `${CARD} block p-4 ${href ? 'transition-colors hover:border-zinc-700' : ''}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Section({ title, aside, children, className = '' }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${CARD} ${className}`}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-2">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Filter chips that are links (server-rendered filters, no client state).
export function Chips({ items, label }: { items: { key: string; label: string; count?: number; href: string; on: boolean }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map((c) => (
        <Link key={c.key} href={c.href} aria-current={c.on ? 'true' : undefined}
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm sm:h-8 sm:text-xs ${c.on ? 'border-[#2f5a43] bg-[#17201b] text-[#00C66F]' : 'border-zinc-800 text-zinc-300 hover:bg-zinc-900'}`}>
          {c.label}{c.count !== undefined && <span className="tabular-nums opacity-60">{c.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function PlanTag({ plan }: { plan: string }) {
  const founder = plan === 'founder';
  return (
    <span className={`inline-flex h-5 items-center rounded border px-1.5 text-[11px] font-medium ${founder ? 'border-[#2f5a43] text-[#3ddc97]' : 'border-zinc-700 text-zinc-300'}`}>
      {plan === 'addon_connector' ? 'Add-on' : plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

export const customerHref = (email: string) => `/admin/customers/${encodeURIComponent(email)}`;
