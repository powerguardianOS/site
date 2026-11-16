// The ONE place that knows what things cost (EUR, incl. VAT). The pricing page, the docs, the meta description and
// PayPal all read these numbers — nothing else may hard-code a price (owner rule: numbers identical everywhere).
//
// Only NEW purchases use this table. Existing licences are never re-priced: a purchase only ever creates a new
// licence, and nothing that renews, claims or checks a licence reads a price.
//
// At launch there is ONE billing period: a year. A PayPal order still names its period ("plan/year") so a second
// period can be added later without changing the order format; until then anything else is refused.

export type Period = 'year';
export const isPeriod = (p: unknown): p is Period => p === 'year';

export const PRICING = {
  home: { name: 'Home', year: 49, connectors: 1 },
  pro: { name: 'Pro', year: 149, connectors: 5 },
  addon_connector: { name: 'Extra connector', year: 25, connectors: 1 }, // one extra connector for one site
} as const;

export type PricedPlan = keyof typeof PRICING;
export const isPricedPlan = (p: unknown): p is PricedPlan => typeof p === 'string' && Object.prototype.hasOwnProperty.call(PRICING, p);

export const VAT_NOTE = 'Prices in euro, incl. VAT.';

// What a PayPal order for this plan and period costs.
export const priceOf = (plan: PricedPlan, period: Period): number => PRICING[plan][period];

// €49, €4.99 — whole euros without decimals.
export const eur = (n: number) => '€' + (Number.isInteger(n) ? String(n) : n.toFixed(2));

// "Home €49/year" — for meta descriptions and docs.
export const priceLine = (plan: PricedPlan) => `${PRICING[plan].name} ${eur(PRICING[plan].year)}/year`;

// The end date of a licence bought now: 12 calendar months, clamped to the month's last day
// (29 February 2028 + 1 year = 28 February 2029).
export function yearEnd(now = Date.now()): string {
  const d = new Date(now);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}
