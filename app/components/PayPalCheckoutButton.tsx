'use client';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

interface Props {
  plan: 'home' | 'pro' | 'addon_connector';
  highlight?: boolean;
}

export default function PayPalCheckoutButton({ plan, highlight }: Props) {
  return (
    <PayPalScriptProvider
      options={{
        clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '',
        currency: 'EUR',
        components: 'buttons',
      }}
    >
      <PayPalButtons
        style={{
          layout: 'horizontal',
          color: highlight ? 'gold' : 'silver',
          label: 'buynow',
          height: 35,
          tagline: false,
        }}
        createOrder={async () => {
          const r = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan }),
          });
          const d = await r.json();
          return d.id;
        }}
        onApprove={async (data: { orderID: string }) => {
          const r = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: data.orderID, plan }),
          });
          const d = await r.json();
          if (d.ok) {
            window.location.href = '/pricing?success=1';
          } else {
            alert('Payment failed — please try again.');
          }
        }}
      />
    </PayPalScriptProvider>
  );
}
