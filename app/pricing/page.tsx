"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import StripeCheckoutButton from '../components/StripeCheckoutButton';
import Link from "next/link";

const plans = [
  {
    id: "home",
    name: "Home",
    desc: "Single site, single connector.",
    monthly: 2.99,
    annual: 25,
    annualMonthly: 2.08,
    connectors: 1,
    sites: 1,
    features: [
      { label: "Remote access via cloud proxy", ok: true },
      { label: "Encrypted credential vault", ok: true },
      { label: "Signed OTA updates", ok: true },
      { label: "Alert rule engine", ok: true },
      { label: "Automation flows", ok: true },
      { label: "Multi-site dashboard", ok: false },
      { label: "Multiple connectors", ok: false },
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    desc: "Multiple sites and connectors.",
    monthly: 9.99,
    annual: 99,
    annualMonthly: 8.25,
    connectors: 5,
    sites: 3,
    features: [
      { label: "Remote access via cloud proxy", ok: true },
      { label: "Encrypted credential vault", ok: true },
      { label: "Signed OTA updates", ok: true },
      { label: "Alert rule engine", ok: true },
      { label: "Automation flows", ok: true },
      { label: "Multi-site dashboard", ok: true },
      { label: "Multiple connectors", ok: true },
    ],
    highlight: true,
  },
];

function PricingContent() {
  const [annual, setAnnual] = useState(false);
  const params = useSearchParams();
  const success = params.get("success") === "1";

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 pt-16 pb-24 space-y-16">

      {success && (
        <div className="rounded-xl border border-[#00C66F]/30 bg-[#00C66F]/[0.06] px-6 py-4 text-sm text-[#00C66F]">
          Payment received — your license is active. Check your inbox for the activation email.
        </div>
      )}

      {/* Header */}
      <div className="space-y-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[#00C66F]/60 font-mono">Pricing</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
          Simple. No per-device fees.
        </h1>
        <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
          One license covers the Controller and all Connectors up to your plan limit.
          Software runs on your hardware indefinitely — no metered metrics, no feature paywalls.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center border border-white/[0.08] rounded-xl overflow-hidden text-sm bg-[#0d1321]">
          <button
            onClick={() => setAnnual(false)}
            className={`px-5 py-2.5 transition-all ${!annual ? "bg-[#00C66F]/10 text-[#00C66F]" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-5 py-2.5 transition-all ${annual ? "bg-[#00C66F]/10 text-[#00C66F]" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Annual <span className="text-[#00C66F] text-xs ml-1">~25% off</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-7 flex flex-col gap-6 ${
              plan.highlight
                ? "border-[#00C66F]/30 bg-gradient-to-b from-[#00C66F]/[0.06] to-[#0d1321] shadow-[0_0_48px_rgba(0,198,111,0.07)] overflow-hidden"
                : "border-white/[0.07] bg-[#0d1321]"
            }`}
          >
            {plan.highlight && (
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00C66F]/50 to-transparent" />
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                {plan.highlight && (
                  <span className="text-[10px] border border-[#00C66F]/30 text-[#00C66F] px-2.5 py-0.5 rounded-lg font-mono bg-[#00C66F]/[0.05]">
                    MOST POPULAR
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">{plan.desc}</p>
            </div>

            <div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-white">
                  €{annual ? plan.annualMonthly : plan.monthly}
                </span>
                <span className="text-zinc-500 text-base mb-1">/mo</span>
              </div>
              {annual && (
                <p className="text-xs text-zinc-500 mt-0.5">billed as €{plan.annual}/yr</p>
              )}
            </div>

            <div className="flex gap-3">
              <span className="font-mono text-xs border border-white/[0.07] rounded-lg px-2.5 py-1 text-zinc-400 bg-[#090d1a]">
                {plan.connectors} connector{plan.connectors > 1 ? "s" : ""}
              </span>
              <span className="font-mono text-xs border border-white/[0.07] rounded-lg px-2.5 py-1 text-zinc-400 bg-[#090d1a]">
                {plan.sites} site{plan.sites > 1 ? "s" : ""}
              </span>
            </div>

            <ul className="space-y-2.5 flex-1 border-t border-white/[0.06] pt-5">
              {plan.features.map(f => (
                <li key={f.label} className="flex items-center gap-2 text-sm">
                  <span className={f.ok ? "text-[#00C66F]" : "text-zinc-700"}>{f.ok ? "✓" : "✗"}</span>
                  <span className={f.ok ? "text-zinc-300" : "text-zinc-600"}>{f.label}</span>
                </li>
              ))}
            </ul>

            <StripeCheckoutButton plan={plan.id as 'home' | 'pro'} annual={annual} highlight={plan.highlight} />
          </div>
        ))}
      </div>

      {/* Add-on */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d1321] p-7">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#00C66F]/60 font-mono">Add-on</div>
            <h3 className="text-base font-semibold text-white">Extra Connector</h3>
            <p className="text-sm text-zinc-400 max-w-sm">
              Extend an existing Home or Pro license with one additional connector slot.
            </p>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-3xl font-bold text-white">€2.99</span>
              <span className="text-zinc-500 text-sm">/mo</span>
              <span className="text-zinc-600 text-xs">or €25 one-time</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full md:w-56 shrink-0">
            <StripeCheckoutButton plan="addon_connector" annual={annual} />
            <Link href="/account" className="text-xs text-zinc-500 hover:text-zinc-300 text-center transition-colors">
              Manage existing license →
            </Link>
          </div>
        </div>
      </div>

      {/* Guarantees */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-zinc-500">
        {[
          ["Self-hosted", "Runs on your hardware, not ours"],
          ["Air-gap ready", "30-day grace period offline"],
          ["Cancel anytime", "Software keeps working"],
          ["No per-UPS fees", "Flat rate per plan tier"],
        ].map(([title, sub]) => (
          <div key={title} className="rounded-xl border border-white/[0.06] bg-[#0d1321]/60 p-4 space-y-1">
            <div className="text-zinc-300 font-medium text-sm flex items-center gap-2">
              <span className="text-[#00C66F]">✓</span> {title}
            </div>
            <div>{sub}</div>
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
