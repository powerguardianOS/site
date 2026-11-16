import { getPayPalOrder, capturePayPalOrder } from '@/app/lib/paypal';
import { PRICING, isPeriod, isPricedPlan, priceOf, yearEnd } from '@/app/lib/pricing';
import type { Period, PricedPlan } from '@/app/lib/pricing';
import { createLicense, getLicenses } from '@/app/lib/license-db';
import { createAddon } from '@/app/lib/addons';

export type Purchase =
  | { ok: true; email: string; plan: PricedPlan; period: Period; expires_at: string; license_id: string }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): Purchase => ({ ok: false, status, error });

// "plan/period" or "plan/period:parentLicenseId" — written by create-order, read back here. An order without a period
// (made before this price table) or with a period we do not sell is refused before anything is captured.
export function parseCustomId(v: string): { plan: PricedPlan; period: Period; parent: string } | null {
  const i = v.indexOf(':');
  const head = i < 0 ? v : v.slice(0, i), parent = i < 0 ? '' : v.slice(i + 1);
  const [plan, period, extra] = head.split('/');
  if (!isPricedPlan(plan) || !isPeriod(period) || extra !== undefined) return null;
  if (plan === 'addon_connector' ? !parent : !!parent) return null;
  return { plan, period, parent };
}

// Fulfil a PayPal order. The plan, the add-on's site and the price all come from PayPal's own record of the order
// (set by create-order on the server) — nothing the browser sends decides what gets created.
export async function fulfilPurchase(orderID: string): Promise<Purchase> {
  const order = await getPayPalOrder(orderID);
  if (order.status !== 'APPROVED') return fail(409, 'order_not_approved');
  const what = parseCustomId(order.custom_id);
  if (!what) return fail(400, 'unknown_order');
  // The price comes from OUR table for this plan and period; the amount on the order must match it exactly.
  const price = priceOf(what.plan, what.period);
  if (order.currency !== 'EUR' || Number(order.amount) !== price) return fail(400, 'amount_mismatch');

  if ((await getLicenses()).some((l) => l.notes === `paypal:${orderID}`)) return fail(409, 'already_fulfilled');

  const paid = await capturePayPalOrder(orderID);
  if (paid.status !== 'COMPLETED') return fail(402, 'payment_not_completed');
  if (paid.currency !== 'EUR' || Number(paid.amount) !== price) return fail(400, 'amount_mismatch');

  // A purchase is a one-off payment for one year: the licence runs 12 calendar months from now.
  const notes = `paypal:${orderID}`;
  const expires_at = yearEnd();
  const done = { ok: true as const, email: paid.email, plan: what.plan, period: what.period, expires_at };
  if (what.plan === 'addon_connector') {
    const added = await createAddon({ parent_id: what.parent, connectors: PRICING.addon_connector.connectors, expires_at, notes });
    if (!added.ok) return fail(added.status, added.error);
    return { ...done, license_id: added.value.id };
  }
  const lic = await createLicense({
    email: paid.email, plan: what.plan, site_id: 'default-site',
    connector_limit: PRICING[what.plan].connectors, expires_at, notes,
  });
  return { ...done, license_id: lic.id };
}
