// The ONE place that knows what things cost (EUR, incl. VAT). The pricing page, the docs, the meta description and
// PayPal all read these numbers — nothing else may hard-code a price (owner rule: numbers identical everywhere).
//
// Only NEW purchases use this table. Existing licences are never re-priced: a purchase only ever creates a new
// licence, and nothing that renews, claims or checks a licence reads a price.

export type Period = 'month' | 'year';
export const PERIODS: readonly Period[] = ['month', 'year'];
export const PERIOD_MONTHS: Record<Period, number> = { month: 1, year: 12 };

export const PRICING = {
  home: { name: 'Home', month: 4.99, year: 49, connectors: 1 },
  pro: { name: 'Pro', month: 14.99, year: 149, connectors: 5 },
  addon_connector: { name: 'Extra connector', month: 2.99, year: 25, connectors: 1 }, // one extra connector for one site
} as const;

export type PricedPlan = keyof typeof PRICING;
export const isPricedPlan = (p: unknown): p is PricedPlan => typeof p === 'string' && Object.prototype.hasOwnProperty.call(PRICING, p);
export const isPeriod = (p: unknown): p is Period => p === 'month' || p === 'year';

export const VAT_NOTE = 'Prices in euro, incl. VAT.';

// What a PayPal order for this plan and period costs.
export const priceOf = (plan: PricedPlan, period: Period): number => PRICING[plan][period];

// €4.99, €49 — whole euros without decimals.
export const eur = (n: number) => '€' + (Number.isInteger(n) ? String(n) : n.toFixed(2));

// How many months the yearly price saves compared to paying monthly ("2 months free").
export const monthsFree = (plan: PricedPlan) => Math.round(12 - PRICING[plan].year / PRICING[plan].month);

// "Home €4.99/month or €49/year" — for meta descriptions and docs.
export const priceLine = (plan: PricedPlan) => `${PRICING[plan].name} ${eur(PRICING[plan].month)}/month or ${eur(PRICING[plan].year)}/year`;

// The end date of a licence bought now for one period: calendar months, clamped to the month's last day
// (31 January + 1 month = 28/29 February), so a monthly licence never skips a month.
export function periodEnd(period: Period, now = Date.now()): string {
  const d = new Date(now);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + PERIOD_MONTHS[period]);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}
