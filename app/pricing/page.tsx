"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PayPalCheckoutButton from '../components/PayPalCheckoutButton';
import PayPalSubscribeButton from '../components/PayPalSubscribeButton';

const plans = [
  {
    id: "home",
    name: "Home",
    desc: "Single site, single connector.",
    monthly: 4.99,
    annual: 45,
    annualMonthly: 3.75,
    connectors: "1 connector included",
    features: [
      { label: "Remote access", ok: true },
      { label: "Encrypted vault", ok: true },
      { label: "OTA updates", ok: true },
      { label: "Alert rules", ok: true },
      { label: "Multi-site", ok: false },
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    desc: "Multiple sites and connectors.",
    monthly: 14.99,
    annual: 140,
    annualMonthly: 11.67,
    connectors: "3 sites · 5 connectors",
    features: [
      { label: "Remote access", ok: true },
      { label: "Encrypted vault", ok: true },
      { label: "OTA updates", ok: true },
      { label: "Alert rules", ok: true },
      { label: "Multi-site", ok: true },
    ],
    cta: "Get Started",
    highlight: true,
    badge: "Most Popular",
  },
];

function PricingContent() {
  const [annual, setAnnual] = useState(false);
  const [success, setSuccess] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("success") === "1") setSuccess(true);
  }, [params]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12 space-y-14">
      {success && (
        <div className="rounded-xl border border-[#00C66F]/40 bg-[#00C66F]/10 px-6 py-4 text-center text-sm text-[#00C66F]">
          Payment successful — check your email for your license key.
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          Simple, transparent <span className="text-[#00C66F]">pricing</span>
        </h1>
        <p className="text-zinc-400 max-w-xl mx-auto">
          Self-hosted on your own hardware. No vendor lock-in, no hidden fees.
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm">
          <span className={!annual ? "text-white font-medium" : "text-zinc-500"}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            aria-label="Toggle billing period"
            className={`relative h-5 w-9 rounded-full transition-colors ${annual ? "bg-[#00C66F]" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${annual ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <span className={annual ? "text-white font-medium" : "text-zinc-500"}>
            Annual <span className="text-[#00C66F] text-xs">save ~30%</span>
          </span>
        </div>
      </div>

      {/* Pricing grid — 2 centered cards */}
      <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-xl border p-6 flex flex-col gap-5 ${
              plan.highlight
                ? "border-[#00C66F]/50 bg-[#00C66F]/5 shadow-[0_0_35px_rgba(0,198,111,0.10)] mt-4"
                : "border-zinc-800 bg-zinc-950/70"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#00C66F]/40 bg-[#00C66F]/10 px-3 py-0.5 text-xs font-medium text-[#00C66F]">
                {plan.badge}
              </span>
            )}

            {/* Name + desc */}
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="text-xs text-zinc-500">{plan.desc}</p>
            </div>

            {/* Price */}
            <div>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold">
                  €{annual ? plan.annualMonthly : plan.monthly}
                </span>
                <span className="text-zinc-500 text-sm mb-1">/mo</span>
              </div>
              {annual && (
                <p className="text-xs text-zinc-500 mt-0.5">billed as €{plan.annual}/yr</p>
              )}
            </div>

            {/* Connector count */}
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{plan.connectors}</p>

            {/* Feature list with divider */}
            <ul className="space-y-2 flex-1 border-t border-zinc-800 pt-4">
              {plan.features.map((f) => (
                <li key={f.label} className="flex items-center gap-2 text-sm">
                  <span className={f.ok ? "text-[#00C66F]" : "text-zinc-700"}>
                    {f.ok ? "✓" : "✗"}
                  </span>
                  <span className={f.ok ? "text-zinc-300" : "text-zinc-600"}>{f.label}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div>
              {annual
                ? <PayPalCheckoutButton plan={plan.id as 'home' | 'pro'} highlight={plan.highlight} />
                : <PayPalSubscribeButton plan={plan.id as 'home' | 'pro'} highlight={plan.highlight} />
              }
            </div>
          </div>
        ))}
      </div>

      {/* Add a connector — prominent section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-2">Add-on</div>
            <h3 className="text-lg font-semibold">Extra Connector</h3>
            <p className="text-sm text-zinc-400 max-w-sm">
              Already have a Home or Pro license? Add one extra connector to your existing plan.
            </p>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-2xl font-bold">€2.99</span>
              <span className="text-zinc-500 text-sm">/mo</span>
              <span className="text-zinc-600 text-xs">or €25 one-time</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full md:w-60 shrink-0">
            {annual
              ? <PayPalCheckoutButton plan="addon_connector" />
              : <PayPalSubscribeButton plan="addon_connector" />
            }
            <Link href="/account" className="text-xs text-zinc-500 hover:text-zinc-300 text-center transition-colors">
              Manage existing license →
            </Link>
          </div>
        </div>
      </div>

      {/* Trust row */}
      <div className="flex flex-wrap justify-center gap-6 text-xs text-zinc-500">
        {["Self-hosted on your hardware", "No cloud required", "Cancel anytime", "Runs on €30 NanoPi"].map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}
