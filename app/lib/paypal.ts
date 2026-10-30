// /Users/ict/Projects/site/app/lib/paypal.ts
export const runtime = 'edge';

const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === '1' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
import { kvGet, kvPut } from '@/app/lib/kv';
import { PLAN_PRICES } from '@/app/lib/pricing';
export { PLAN_PRICES };

export async function getPayPalToken(): Promise<string> {
  const response = await fetch(PAYPAL_BASE + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await response.json();
  return data.access_token;
}

// What was bought is fixed HERE, on the server, when the order is made (custom_id) and re-read at capture time:
// the browser never gets to say which plan a payment was for.
export async function createPayPalOrder(plan: string, parentId?: string): Promise<string> {
  const token = await getPayPalToken();
  const response = await fetch(PAYPAL_BASE + '/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'EUR',
            value: PLAN_PRICES[plan].toFixed(2),
          },
          custom_id: parentId ? plan + ':' + parentId : plan,
          description: 'PowerGuardian ' + plan + ' license (annual)',
        },
      ],
    }),
  });
  const data = await response.json();
  return data.id;
}

export type PayPalOrder = { status: string; custom_id: string; amount: string; currency: string; email: string };

function readOrder(data: any): PayPalOrder {
  const unit = data?.purchase_units?.[0];
  const cap = unit?.payments?.captures?.[0];
  const amt = cap?.amount ?? unit?.amount;
  return {
    status: String(data?.status ?? ''),
    custom_id: String(cap?.custom_id ?? unit?.custom_id ?? ''),
    amount: String(amt?.value ?? ''),
    currency: String(amt?.currency_code ?? ''),
    email: String(data?.payer?.email_address ?? ''),
  };
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  const token = await getPayPalToken();
  const response = await fetch(PAYPAL_BASE + '/v2/checkout/orders/' + encodeURIComponent(orderId), {
    headers: { Authorization: 'Bearer ' + token },
  });
  return readOrder(await response.json());
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalOrder> {
  const token = await getPayPalToken();
  const response = await fetch(PAYPAL_BASE + '/v2/checkout/orders/' + encodeURIComponent(orderId) + '/capture', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
  });
  return readOrder(await response.json());
}

export type WebhookVerdict = 'ok' | 'invalid' | 'not_configured' | 'duplicate' | 'unavailable';

// PayPal signs every webhook. We never trust the body on its own: PayPal's
// verify-webhook-signature API must answer SUCCESS for OUR webhook id.
export async function verifyPayPalWebhook(headers: Headers, event: unknown): Promise<WebhookVerdict> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return 'not_configured';
  const h = (n: string) => headers.get(n) ?? '';
  const certUrl = h('paypal-cert-url');
  let certHost = '';
  try { const u = new URL(certUrl); if (u.protocol === 'https:') certHost = u.hostname; } catch { /* invalid */ }
  const sent = Date.parse(h('paypal-transmission-time'));
  if (!Number.isFinite(sent) || Math.abs(Date.now() - sent) > 5 * 60_000) return 'invalid'; // stale or from the future
  if (!h('paypal-transmission-id') || !h('paypal-transmission-sig') || !h('paypal-transmission-time') || !h('paypal-auth-algo')) return 'invalid';
  if (certHost !== 'paypal.com' && !certHost.endsWith('.paypal.com')) return 'invalid';
  try {
    const token = await getPayPalToken();
    const r = await fetch(PAYPAL_BASE + '/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: h('paypal-auth-algo'),
        cert_url: certUrl,
        transmission_id: h('paypal-transmission-id'),
        transmission_sig: h('paypal-transmission-sig'),
        transmission_time: h('paypal-transmission-time'),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });
    if (!r.ok) return 'invalid';
    const data = (await r.json()) as { verification_status?: string };
    if (data.verification_status !== 'SUCCESS') return 'invalid';
    // Replay protection: a signed delivery is processed once per transmission id.
    const key = 'pp:tx:' + h('paypal-transmission-id');
    try {
      if ((await kvGet(key)) !== null) return 'duplicate';
      await kvPut(key, '1', 86400);
    } catch { return 'unavailable'; } // fail closed: PayPal retries later
    return 'ok';
  } catch {
    return 'invalid';
  }
}
