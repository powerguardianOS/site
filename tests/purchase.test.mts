import { get, seed, lic, check, done, DAY } from './harness.mts';

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
const { PRICING, priceOf, yearEnd, isPeriod } = await import('../app/lib/pricing.ts');
const { POST: createOrder } = await import('../app/api/paypal/create-order/route.ts');

// An existing customer on the OLD price (bought before this price table): nothing below may touch this licence.
const OLD = lic('site1', 'cust@x.nl', { plan: 'home', connector_limit: 1, expires_at: new Date(Date.now() + 100 * DAY).toISOString(), notes: 'paypal:OLD-ORDER' });
seed(OLD, lic('sub9', 'old@x.nl', { plan: 'pro', notes: 'paypal-sub:I-OLD' }));
const before9 = JSON.stringify(get('license:sub9'));
const months = (iso: string) => { const a = new Date(), b = new Date(iso); return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth(); };

console.log('price table');
check('new prices, yearly only: Home €49/year, Pro €149/year, extra connector €25/year',
  priceOf('home', 'year') === 49 && priceOf('pro', 'year') === 149 && priceOf('addon_connector', 'year') === 25);
check('there is no monthly price (yearly only at launch)', !isPeriod('month') && Object.values(PRICING).every((p) => !('month' in p)));
check('connectors per plan unchanged: Home 1, Pro 5', PRICING.home.connectors === 1 && PRICING.pro.connectors === 5);
check('12 months after 29 February 2028 is 28 February 2029', yearEnd(Date.UTC(2028, 1, 29, 12)).startsWith('2029-02-28'));
check('12 months after 31 January 2027 is 31 January 2028', yearEnd(Date.UTC(2027, 0, 31, 12)).startsWith('2028-01-31'));

console.log('order');
check('custom_id is parsed: plan, period, and a site only for add-ons',
  parseCustomId('home/year')?.period === 'year' && parseCustomId('pro/year')?.plan === 'pro' &&
  parseCustomId('addon_connector/year:site1')?.parent === 'site1' && parseCustomId('pro/month') === null &&
  parseCustomId('addon_connector/year') === null && parseCustomId('pro/year:site1') === null && parseCustomId('lifetime/year') === null &&
  parseCustomId('home/week') === null && parseCustomId('home/year/x') === null && parseCustomId('toString/year') === null);
check('an order from before this price table (no period, old price) is not understood', parseCustomId('home') === null);

const sent: any[] = [];
const base2 = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  if (String(url).endsWith('/v2/checkout/orders')) { sent.push(JSON.parse(init.body)); return Response.json({ id: 'NEW' }); }
  return base2(url, init);
};
const mk = (b: unknown) => createOrder(new Request('http://x/api/paypal/create-order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }) as any);
await mk({ plan: 'home', period: 'year', amount: '0.01' });
await mk({ plan: 'pro', period: 'year', value: '1.00' });
await mk({ plan: 'home' });
check('create-order charges OUR price, whatever amount the browser sends',
  sent[0]?.purchase_units[0].amount.value === '49.00' && sent[1]?.purchase_units[0].amount.value === '149.00');
check('create-order writes plan and period into the order', sent[0]?.purchase_units[0].custom_id === 'home/year' && sent[1]?.purchase_units[0].custom_id === 'pro/year');
check('no period given: yearly', sent[2]?.purchase_units[0].custom_id === 'home/year' && sent[2]?.purchase_units[0].amount.value === '49.00');
check('monthly is refused (yearly only): 400, no PayPal order', (await mk({ plan: 'pro', period: 'month' })).status === 400 && (await mk({ plan: 'home', period: 'month' })).status === 400 && sent.length === 3);
check('an unknown period or plan is refused', (await mk({ plan: 'home', period: 'week' })).status === 400 && (await mk({ plan: 'founder', period: 'year' })).status === 400 && sent.length === 3);

console.log('purchase');
order('y1', 'home/year', '49.00');
const r1 = await fulfilPurchase('y1') as any;
const l1 = get('license:' + r1.license_id);
check('Home yearly at €49: a Home licence (1 connector) that runs 12 months', r1.ok && l1.plan === 'home' && l1.connector_limit === 1 && months(l1.expires_at) === 12, l1?.expires_at);

order('y2', 'pro/year', '149.00');
const r2 = await fulfilPurchase('y2') as any;
const l2 = get('license:' + r2.license_id);
check('Pro yearly at €149: a Pro licence (5 connectors) that runs 12 months', r2.ok && l2.plan === 'pro' && l2.connector_limit === 5 && months(l2.expires_at) === 12, l2?.expires_at);

order('m1', 'pro/month', '14.99');
check('a monthly order (not sold) is refused before capture', (await fulfilPurchase('m1') as any).error === 'unknown_order');

order('t1', 'pro/year', '14.99');
check('tampered: Pro yearly paid at a lower price is refused', (await fulfilPurchase('t1') as any).error === 'amount_mismatch');
order('t2', 'home/year', '25.00');
check('tampered: Home yearly at the OLD price (€25) is refused', (await fulfilPurchase('t2') as any).error === 'amount_mismatch');
order('t3', 'addon_connector/year:site1', '2.99');
check('tampered: an add-on at the OLD monthly price (€2.99) is refused', (await fulfilPurchase('t3') as any).error === 'amount_mismatch');
order('t4', 'home/year', '149.00');
check('paying the Pro price on a Home order is refused (exact match only)', (await fulfilPurchase('t4') as any).error === 'amount_mismatch');
order('t5', 'home', '25.00');
check('a legacy order without a period is refused', (await fulfilPurchase('t5') as any).error === 'unknown_order');
const captured = captures;
check('a refused price is never captured (no money taken)', ['m1', 't1', 't2', 't3', 't4', 't5'].every((id) => orders.get(id).status === 'APPROVED') && captured === 2);
check('an unapproved order is refused', (await fulfilPurchase('nope') as any).error === 'order_not_approved');
order('u1', 'whatever/year', '49.00');
check('an unknown plan in the order is refused', (await fulfilPurchase('u1') as any).error === 'unknown_order');
order('y1', 'home/year', '49.00');
check('…an order is fulfilled once, even if PayPal still reports it as approved', (await fulfilPurchase('y1') as any).error === 'already_fulfilled' && captures === captured);

order('a1', 'addon_connector/year:site1', '25.00');
const r5 = await fulfilPurchase('a1') as any;
const add = get('license:' + r5.license_id);
check('an add-on order creates a licence that points at the site (parent_id) and runs 12 months', r5.ok && add.plan === 'addon_connector' && add.parent_id === 'site1' && months(add.expires_at) === 12);
check('the site licence lists the add-on', get('license:site1').addon_ids.includes(r5.license_id));
order('a2', 'addon_connector/year:ghost', '25.00');
check('an add-on for a site that does not exist is refused', (await fulfilPurchase('a2') as any).error === 'parent_not_found');
order('a3', 'addon_connector/year:site1', '5.00');
check('an add-on at the wrong price is refused', (await fulfilPurchase('a3') as any).error === 'amount_mismatch');

console.log('existing customers keep their deal');
const now1 = get('license:site1');
check('the existing licence keeps plan, connectors, end date and order (only the add-on link was added)',
  now1.plan === OLD.plan && now1.connector_limit === OLD.connector_limit && now1.expires_at === OLD.expires_at && now1.notes === OLD.notes && now1.status === 'active' && now1.token === OLD.token);
check('another customer\'s old-price subscription licence is untouched by new purchases', JSON.stringify(get('license:sub9')) === before9);
done();
