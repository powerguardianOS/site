// /Users/ict/Projects/site/app/lib/paypal.ts
export const runtime = 'edge';

const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === '1' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
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
