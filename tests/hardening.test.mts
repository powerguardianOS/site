// Review follow-ups: env override guard, PayPal replay dedup.
import { kv, mails, get, seed, lic, check, done } from './harness.mts';

process.env.PAYPAL_CLIENT_ID = 'id'; process.env.PAYPAL_CLIENT_SECRET = 's'; process.env.PAYPAL_WEBHOOK_ID = 'WH-1';
const urls: string[] = [];
const base = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const u = String(url); urls.push(u);
  if (u.includes('paypal.com')) {
    if (u.includes('/oauth2/token')) return Response.json({ access_token: 'tok' });
    if (u.includes('/verify-webhook-signature')) return Response.json({ verification_status: 'SUCCESS' });
  }
  return base(url, init);
};
const { kvGet } = await import('../app/lib/kv.ts');

console.log('env override guard');
for (const [val, expectHost] of [['https://evil.example/client/v4', 'api.cloudflare.com'], ['http://127.0.0.1:8788', '127.0.0.1'], ['http://localhost:8788', 'localhost'], ['http://127.0.0.1.evil.example', 'api.cloudflare.com'], ['not a url', 'api.cloudflare.com']] as const) {
  process.env.CLOUDFLARE_API_BASE = val; urls.length = 0;
  await kvGet('k').catch(() => {});
  check(`CLOUDFLARE_API_BASE=${val} -> ${expectHost}`, new URL(urls[0]).hostname === expectHost, urls[0]);
}
delete process.env.CLOUDFLARE_API_BASE;
const { sendEmail } = await import('../app/lib/email.ts');
process.env.BREVO_API_BASE = 'https://evil.example'; urls.length = 0;
await sendEmail('a@x.nl', 's', 't').catch(() => {});
check('BREVO_API_BASE pointing off-box is ignored', new URL(urls[0]).hostname === 'api.brevo.com', urls[0]);
delete process.env.BREVO_API_BASE;

console.log('\npaypal replay');
const { POST } = await import('../app/api/paypal/webhook/route.ts');
seed(lic('sub1', 'cust@x.nl', { notes: 'paypal-sub:I-ABC' }));
const hdr = (id: string, time = new Date().toISOString()) => ({
  'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/C',
  'paypal-transmission-id': id, 'paypal-transmission-sig': 'sig', 'paypal-transmission-time': time,
});
const ev = { event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-ABC' } };
const call = (h: Record<string, string>) => POST(new Request('http://x/w', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(ev) }) as any);
mails.length = 0;
let r = await call(hdr('t1'));
check('first delivery processed (one mail)', r.status === 200 && mails.length === 1 && get('license:sub1').status === 'expired');
r = await call(hdr('t1'));
check('replay of the same transmission id: 200 but nothing happens (no 2nd mail)', r.status === 200 && mails.length === 1);
r = await call(hdr('t2', new Date(Date.now() - 20 * 60_000).toISOString()));
check('stale transmission time (>5 min) is rejected', r.status === 401);
check('dedup key is stored with the id', [...kv.keys()].some((k) => k.includes('t1')));
done();
