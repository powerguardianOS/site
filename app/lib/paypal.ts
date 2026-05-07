// /Users/ict/Projects/site/app/lib/paypal.ts
export const runtime = 'edge';

const PAYPAL_BASE = process.env.PAYPAL_SANDBOX === '1' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const PLAN_PRICES: Record<string, number> = { home: 45, pro: 140, addon_connector: 25 };

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

export async function createPayPalOrder(plan: string): Promise<string> {
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
          description: 'PowerGuardian ' + plan + ' license (annual)',
        },
      ],
    }),
  });
  const data = await response.json();
  return data.id;
}

export async function capturePayPalOrder(orderId: string): Promise<{ email: string; status: string }> {
  const token = await getPayPalToken();
  const response = await fetch(PAYPAL_BASE + '/v2/checkout/orders/' + orderId + '/capture', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  return {
    email: data.payer?.email_address ?? '',
    status: data.status,
  };
}
