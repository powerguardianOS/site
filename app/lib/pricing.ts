// The ONE place that knows what things cost (EUR). The pricing page shows these numbers and PayPal charges exactly
// these numbers — they used to be two separate lists that disagreed (page: Home €25/yr, PayPal: €45).
export const PRICING = {
  home: { monthly: 2.99, annual: 25 },
  pro: { monthly: 9.99, annual: 99 },
  addon_connector: { monthly: 2.99, annual: 25 }, // one extra connector for one site
} as const;

export type PricedPlan = keyof typeof PRICING;

// What a PayPal order for a plan costs (an annual license).
export const PLAN_PRICES: Record<string, number> = Object.fromEntries(
  Object.entries(PRICING).map(([k, v]) => [k, v.annual]),
);
