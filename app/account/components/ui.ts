// ACCOUNT-UI: shared look of the account page. Dark, calm, brand green #00C66F for the one primary action.
export const card = 'rounded-2xl border border-white/10 bg-zinc-900/60';
export const primaryBtn =
  'inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-[#00C66F] px-4 text-sm font-medium text-black transition-colors hover:bg-[#00b564] disabled:cursor-wait disabled:opacity-50';
export const ghostBtn =
  'inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50';
export const smallBtn =
  'inline-flex min-h-[36px] items-center rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50';
export const input =
  'h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-[#00C66F]';

export const PLAN_BADGE: Record<string, string> = {
  founder: 'border-[#00C66F]/40 bg-[#00C66F]/10 text-[#00C66F]',
  pro: 'border-sky-400/40 bg-sky-400/10 text-sky-300',
  home: 'border-white/20 bg-white/5 text-white/70',
};
export const planBadge = (plan: string) =>
  `inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PLAN_BADGE[plan] ?? PLAN_BADGE.home}`;
