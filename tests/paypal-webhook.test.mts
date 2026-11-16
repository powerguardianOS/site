// PayPal webhook must be signed: verified through PayPal's verify-webhook-signature API.
import { get, seed, lic, check, done } from './harness.mts';

process.env.PAYPAL_CLIENT_ID = 'id'; process.env.PAYPAL_CLIENT_SECRET = 's';
let verifyCalls = 0, verifyBody: any = null, verdict = 'SUCCESS';
const base = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const u = String(url);
  if (!u.includes('paypal.com')) return base(url, init);
  if (u.includes('/oauth2/token')) return Response.json({ access_token: 'tok' });
  if (u.includes('/verify-webhook-signature')) { verifyCalls++; verifyBody = JSON.parse(init.body); return Response.json({ verification_status: verdict }); }
  return Response.json({});
};

delete process.env.CHECKOUT_OPEN; // checkout closed: webhooks of existing subscriptions must keep working
const { POST } = await import('../app/api/paypal/webhook/route.ts');
seed(lic('sub1', 'cust@x.nl', { notes: 'paypal-sub:I-ABC' }));
const event = { event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-ABC' } };
const goodHeaders = {
  'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/CERT-1',
  'paypal-transmission-id': 'tid', 'paypal-transmission-sig': 'sig', 'paypal-transmission-time': new Date().toISOString(),
};
const call = (headers: Record<string, string>, body: unknown = event) =>
  POST(new Request('http://x/api/paypal/webhook', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }) as any);

console.log('paypal webhook');
process.env.PAYPAL_WEBHOOK_ID = 'WH-1';
let r = await call({});
check('unsigned request is rejected (401) and changes nothing', r.status === 401 && get('license:sub1').status === 'active');
check('unsigned request does not even reach PayPal', verifyCalls === 0);

r = await call({ ...goodHeaders, 'paypal-cert-url': 'https://evil.example/cert' });
check('cert URL outside paypal.com is rejected before any call', r.status === 401 && verifyCalls === 0 && get('license:sub1').status === 'active');

verdict = 'FAILURE';
r = await call(goodHeaders);
check('PayPal says FAILURE: rejected, licence untouched', r.status === 401 && get('license:sub1').status === 'active' && verifyCalls === 1);

verdict = 'SUCCESS';
r = await call(goodHeaders);
check('PayPal says SUCCESS: processed, licence expired', r.status === 200 && get('license:sub1').status === 'expired');
check('verification used our webhook id and the event as sent', verifyBody.webhook_id === 'WH-1' && verifyBody.transmission_id === 'tid' && verifyBody.webhook_event.resource.id === 'I-ABC');

// Existing paying subscribers keep their old deal: a renewal or payment event of an old subscription changes nothing,
// and ending one subscription never touches another licence.
const old = lic('old1', 'old@x.nl', { plan: 'home', connector_limit: 1, expires_at: '2027-03-01T00:00:00.000Z', notes: 'paypal-sub:I-OLD' });
seed(old);
const snap = JSON.stringify(get('license:old1'));
const tick = (id: string) => ({ ...goodHeaders, 'paypal-transmission-id': id, 'paypal-transmission-time': new Date().toISOString() });
for (const [i, t] of ['BILLING.SUBSCRIPTION.RENEWED', 'PAYMENT.SALE.COMPLETED', 'BILLING.SUBSCRIPTION.UPDATED'].entries()) {
  r = await call(tick('renew' + i), { event_type: t, resource: { id: 'I-OLD', amount: { total: '49.00', currency: 'EUR' } } });
  check(`${t} of an old-price subscription: accepted, licence unchanged`, r.status === 200 && JSON.stringify(get('license:old1')) === snap);
}
seed(lic('other', 'o@x.nl', { notes: 'paypal-sub:I-OTHER' }));
r = await call(tick('cancel-other'), { event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-OTHER' } });
check('cancelling another subscription leaves the old-price licence alone', get('license:other').status === 'expired' && JSON.stringify(get('license:old1')) === snap);

delete process.env.PAYPAL_WEBHOOK_ID;
seed(lic('sub2', 'c2@x.nl', { notes: 'paypal-sub:I-DEF' }));
r = await call(goodHeaders, { event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-DEF' } });
check('no PAYPAL_WEBHOOK_ID configured: fails closed (503), licence untouched', r.status === 503 && get('license:sub2').status === 'active');
done();
