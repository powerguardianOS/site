import { getPayPalOrder, capturePayPalOrder, PLAN_PRICES } from '@/app/lib/paypal';
import { createLicense, getLicenses } from '@/app/lib/license-db';
import { createAddon } from '@/app/lib/addons';

export type Purchase =
  | { ok: true; email: string; plan: string; license_id: string }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): Purchase => ({ ok: false, status, error });

// "plan" or "plan:parentLicenseId" — written by create-order, read back here.
export function parseCustomId(v: string): { plan: string; parent: string } | null {
  const [plan, parent = ''] = v.split(':');
  if (!(plan in PLAN_PRICES)) return null;
  if (plan === 'addon_connector' ? !parent : !!parent) return null;
  return { plan, parent };
}

// Fulfil a PayPal order. The plan, the add-on's site and the price all come from PayPal's own record of the order
// (set by create-order on the server) — nothing the browser sends decides what gets created.
export async function fulfilPurchase(orderID: string): Promise<Purchase> {
  const order = await getPayPalOrder(orderID);
  if (order.status !== 'APPROVED') return fail(409, 'order_not_approved');
  const what = parseCustomId(order.custom_id);
  if (!what) return fail(400, 'unknown_order');
  if (order.currency !== 'EUR' || Number(order.amount) !== PLAN_PRICES[what.plan]) return fail(400, 'amount_mismatch');

  if ((await getLicenses()).some((l) => l.notes === `paypal:${orderID}`)) return fail(409, 'already_fulfilled');

  const paid = await capturePayPalOrder(orderID);
  if (paid.status !== 'COMPLETED') return fail(402, 'payment_not_completed');
  if (paid.currency !== 'EUR' || Number(paid.amount) !== PLAN_PRICES[what.plan]) return fail(400, 'amount_mismatch');

  const notes = `paypal:${orderID}`;
  if (what.plan === 'addon_connector') {
    const added = await createAddon({ parent_id: what.parent, connectors: 1, expires_at: null, notes });
    if (!added.ok) return fail(added.status, added.error);
    return { ok: true, email: paid.email, plan: what.plan, license_id: added.value.id };
  }
  const lic = await createLicense({
    email: paid.email, plan: what.plan as 'home' | 'pro', site_id: 'default-site',
    connector_limit: what.plan === 'home' ? 1 : 5, expires_at: null, notes,
  });
  return { ok: true, email: paid.email, plan: what.plan, license_id: lic.id };
}
