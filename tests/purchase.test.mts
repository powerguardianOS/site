import { put, get, seed, lic, check, done, kv } from './harness.mts';

process.env.PAYPAL_CLIENT_ID = 'id'; process.env.PAYPAL_CLIENT_SECRET = 's';
// A tiny fake PayPal on top of the harness' KV/Brevo fetch.
const orders = new Map<string, any>();
let captures = 0;
const base = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const u = String(url);
  if (!u.includes('paypal.com')) return base(url, init);
  if (u.includes('/oauth2/token')) return Response.json({ access_token: 'tok' });
  const m = u.match(/orders\/([^/]+)(\/capture)?$/)!;
  const o = orders.get(decodeURIComponent(m[1]));
  if (!o) return Response.json({});
  if (m[2]) { captures++; o.status = 'COMPLETED'; o.purchase_units[0].payments = { captures: [{ custom_id: o.purchase_units[0].custom_id, amount: o.purchase_units[0].amount }] }; }
  return Response.json(o);
};
const order = (id: string, custom_id: string, value: string, status = 'APPROVED') =>
  orders.set(id, { status, payer: { email_address: 'cust@x.nl' }, purchase_units: [{ custom_id, amount: { currency_code: 'EUR', value } }] });

const { fulfilPurchase, parseCustomId } = await import('../app/lib/purchase.ts');
seed(lic('site1', 'cust@x.nl', { plan: 'home', connector_limit: 1 }));

console.log('purchase');
check('custom_id is parsed; add-on needs a site, others must not have one',
  parseCustomId('home')?.plan === 'home' && parseCustomId('addon_connector:site1')?.parent === 'site1' &&
  parseCustomId('addon_connector') === null && parseCustomId('pro:site1') === null && parseCustomId('lifetime') === null);

order('o1', 'home', '25.00');
const r1 = await fulfilPurchase('o1') as any;
check('a Home order creates a Home license (1 connector)', r1.ok && get('license:' + r1.license_id).plan === 'home' && get('license:' + r1.license_id).connector_limit === 1);

order('o2', 'home', '99.00');
check('paying the Home price for Pro is impossible: price must match what the order says', (await fulfilPurchase('o2') as any).error === 'amount_mismatch');
order('o3', 'pro', '25.00');
check('an order for Pro paid at the Home price is refused', (await fulfilPurchase('o3') as any).error === 'amount_mismatch');
check('an unapproved order is refused', (await fulfilPurchase('o1x') as any).error === 'order_not_approved');
order('o4', 'whatever', '25.00');
check('an unknown plan in the order is refused', (await fulfilPurchase('o4') as any).error === 'unknown_order');
const before = captures;
order('o1', 'home', '25.00');
check('…even if PayPal still reports it as approved', (await fulfilPurchase('o1') as any).error === 'already_fulfilled' && captures === before);

order('o5', 'addon_connector:site1', '25.00');
const r5 = await fulfilPurchase('o5') as any;
const add = get('license:' + r5.license_id);
check('an add-on order creates a license that points at the site (parent_id)', r5.ok && add.plan === 'addon_connector' && add.parent_id === 'site1');
check('the site license lists the add-on', get('license:site1').addon_ids.includes(r5.license_id));
order('o6', 'addon_connector:ghost', '25.00');
check('an add-on for a site that does not exist is refused', (await fulfilPurchase('o6') as any).error === 'parent_not_found');
order('o7', 'addon_connector:site1', '5.00');
check('an add-on at the wrong price is refused', (await fulfilPurchase('o7') as any).error === 'amount_mismatch');
done();
