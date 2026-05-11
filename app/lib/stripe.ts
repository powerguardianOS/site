export async function createCheckoutSession(
  plan: 'home' | 'pro' | 'addon_connector',
  annual: boolean
): Promise<string> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  const baseAmount = annual ? 100 : 1;
  const amountMap = {
    home: annual ? 4500 : 499,
    pro: annual ? 14000 : 1499,
    addon_connector: annual ? 2500 : 299,
  };

  const amount = amountMap[plan];
  const interval = annual ? 'year' : 'month';
  const mode = annual ? 'payment' : 'subscription';
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const displayName = `${planName} (${annual ? 'Annual' : 'Monthly'})`;

  const body = new URLSearchParams({
    'success_url': 'https://powerguardian.cloud/pricing?success=1',
    'cancel_url': 'https://powerguardian.cloud/pricing',
    'mode': mode,
    'metadata[plan]': plan,
    'metadata[annual]': annual.toString(),
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': amount.toString(),
    'line_items[0][price_data][product_data][name]': `PowerGuardian ${displayName}`,
  });

  if (mode === 'subscription') {
    body.append('line_items[0][price_data][recurring][interval]', interval);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(stripeSecretKey + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.url) {
    throw new Error('Stripe API did not return a checkout session URL');
  }

  return data.url;
}