// app/pricing/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";

const plans = [
  {
    id: "home",
    name: "Home",
    desc: "For small setups and home labs.",
    monthly: 5,
    annual: 4,
    connectors: "Up to 10",
    features: [
      { label: "Remote access", ok: true },
      { label: "Multi-site", ok: false },
      { label: "White-label", ok: false },
      { label: "OTA updates", ok: true },
      { label: "Alert rules", ok: true },
    ],
    cta: "Get Started",
    ctaHref: "https://accounts.powerguardian.cloud",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    desc: "For professionals and growing teams.",
    monthly: 15,
    annual: 12,
    connectors: "Unlimited",
    features: [
      { label: "Remote access", ok: true },
      { label: "Multi-site", ok: true },
      { label: "White-label", ok: false },
      { label: "OTA updates", ok: true },
      { label: "Alert rules", ok: true },
    ],
    cta: "Get Pro",
    ctaHref: "https://accounts.powerguardian.cloud",
    highlight: true,
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    desc: "Custom deployments for large environments.",
    monthly: null,
    annual: null,
    connectors: "Unlimited",
    features: [
      { label: "Remote access", ok: true },
      { label: "Multi-site", ok: true },
      { label: "White-label", ok: true },
      { label: "OTA updates", ok: true },
      { label: "Priority support", ok: true },
    ],
    cta: "Contact Us",
    ctaHref: "mailto:hello@powerguardian.cloud",
    highlight: false,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    desc: "Pay once, own it forever.",
    monthly: null,
    annual: null,
    connectors: "Unlimited",
    price_label: "One-time · contact founder",
    features: [
      { label: "Remote access", ok: true },
      { label: "Multi-site", ok: true },
      { label: "White-label", ok: true },
      { label: "All future updates", ok: true },
      { label: "Priority support", ok: true },
    ],
    cta: "Contact Founder",
    ctaHref: "mailto:hello@powerguardian.cloud",
    highlight: false,
    badge: "Limited",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="space-y-14">
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
            className={`relative h-5 w-9 rounded-full transition-colors ${annual ? "bg-[#00C66F]" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${annual ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <span className={annual ? "text-white font-medium" : "text-zinc-500"}>
            Annual <span className="text-[#00C66F] text-xs">save ~20%</span>
          </span>
        </div>
      </div>

      {/* Pricing grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const price = plan.monthly === null
            ? null
            : annual ? plan.annual : plan.monthly;

          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-6 flex flex-col gap-5 transition-colors ${
                plan.highlight
                  ? "border-[#00C66F]/50 bg-[#00C66F]/5 shadow-[0_0_35px_rgba(0,198,111,0.12)]"
                  : "border-zinc-800 bg-zinc-950/70"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#00C66F]/40 bg-[#00C66F]/10 px-3 py-0.5 text-xs font-medium text-[#00C66F]">
                  {plan.badge}
                </span>
              )}

              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="text-xs text-zinc-500">{plan.desc}</p>
              </div>

              <div>
                {price !== null ? (
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold">€{price}</span>
                    <span className="text-zinc-500 text-sm mb-1">/mo</span>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">{plan.price_label ?? "Custom pricing"}</p>
                )}
              </div>

              <ul className="space-y-2 flex-1">
                <li className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{plan.connectors} connectors</li>
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-2 text-sm">
                    <span className={f.ok ? "text-[#00C66F]" : "text-zinc-700"}>
                      {f.ok ? "✓" : "✗"}
                    </span>
                    <span className={f.ok ? "text-zinc-300" : "text-zinc-600"}>{f.label}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={`block text-center rounded-full py-2 text-sm font-medium transition ${
                  plan.highlight
                    ? "bg-[#00C66F] text-black hover:bg-[#00b564] shadow-[var(--pg-cta-shadow)]"
                    : "border border-zinc-700 text-zinc-200 hover:border-[#00C66F] hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          );
        })}
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
