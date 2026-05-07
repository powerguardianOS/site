'use client';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

interface Props {
  plan: 'home' | 'pro' | 'addon_connector';
  highlight?: boolean;
}

const PLAN_IDS: Record<string, string> = {
  home: process.env.NEXT_PUBLIC_PAYPAL_PLAN_HOME ?? '',
  pro: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO ?? '',
  addon_connector: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ADDON ?? '',
};

export default function PayPalSubscribeButton({ plan, highlight }: Props) {
  return (
    <PayPalScriptProvider
      options={{
        clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '',
        currency: 'EUR',
        vault: true,
        intent: 'subscription',
      }}
    >
      <PayPalButtons
        style={{
          layout: 'horizontal',
          color: highlight ? 'gold' : 'silver',
          label: 'subscribe',
          height: 35,
          tagline: false,
        }}
        createSubscription={(_data: Record<string, unknown>, actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } }) =>
          actions.subscription.create({ plan_id: PLAN_IDS[plan] })
        }
        onApprove={async (data: { subscriptionID?: string | null }) => {
          const r = await fetch('/api/paypal/activate-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionID: data.subscriptionID, plan }),
          });
          const d = await r.json();
          if (d.ok) {
            window.location.href = '/pricing?success=1';
          } else {
            alert('Subscription failed — please try again.');
          }
        }}
      />
    </PayPalScriptProvider>
  );
}
