"use client";
import { useState } from "react";
import { PRICING, VAT_NOTE, eur, monthsFree } from "@/app/lib/pricing";
import type { Period } from "@/app/lib/pricing";
import TesterCta from "@/app/components/TesterCta";

// Every number on this page comes from app/lib/pricing.ts — the same table PayPal charges from.
const PLANS = [
  {
    id: "home" as const,
    tagline: "For your home or a small office.",
    points: [
      `1 site, ${PRICING.home.connectors} connector`,
      "Safe shutdown when the power fails",
      "Status and alerts in your account",
    ],
    highlight: false,
  },
  {
    id: "pro" as const,
    tagline: "For a small business or the IT person.",
    points: [
      `1 site, ${PRICING.pro.connectors} connectors`,
      "Open your controller from anywhere",
      "Everything in Home",
    ],
    highlight: true,
  },
];

const BUSINESS = ["More sites in one account", "Share a site with a colleague by e\u2011mail", "Sign in with Microsoft (SSO)"];
const CONTACT = "mailto:hello@powerguardian.cloud?subject=PowerGuardian%20Business";

function Check() {
  return <span aria-hidden className="mt-[3px] text-[#00C66F] text-xs">✓</span>;
}

export default function PricingPage() {
  const [period, setPeriod] = useState<Period>("year");
  const yearly = period === "year";
  const free = monthsFree("home");

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 pt-10 md:pt-16 pb-24 space-y-10 md:space-y-14">

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-xs md:text-sm text-zinc-400 flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        Online purchase is not open yet. These are the prices when it opens.
      </div>

      {/* Header + billing toggle */}
      <div className="space-y-5 md:space-y-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[#00C66F]/60 font-mono">Pricing</div>
        <h1 className="pg-display text-4xl md:text-6xl text-white">
          Simple. <em className="text-zinc-400">No per-device fees.</em>
        </h1>
        <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
          One licence per site covers the Controller and its connectors. The shutdown protection runs on your own hardware and never stops.
        </p>

        <div role="radiogroup" aria-label="Billing period"
          className="grid grid-cols-2 w-full sm:w-auto sm:inline-grid border border-zinc-800 rounded-xl p-1 text-sm bg-zinc-900">
          {(["month", "year"] as const).map((p) => (
            <button key={p} role="radio" aria-checked={period === p} data-period={p} onClick={() => setPeriod(p)}
              className={`px-5 py-2.5 rounded-lg transition-all whitespace-nowrap ${period === p ? "bg-[#00C66F]/10 text-[#00C66F]" : "text-zinc-500 hover:text-zinc-300"}`}>
              {p === "month" ? "Monthly" : <>Yearly <span className="text-[11px] ml-1 text-[#00C66F]">{free} months free</span></>}
            </button>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="grid gap-4 md:gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const p = PRICING[plan.id];
          return (
            <div key={plan.id} data-plan={plan.id}
              className={`relative rounded-2xl border p-6 md:p-7 flex flex-col gap-5 overflow-hidden ${
                plan.highlight
                  ? "border-[#00C66F]/25 bg-gradient-to-b from-[#00C66F]/[0.05] to-[#0b1120] shadow-[0_20px_60px_-25px_rgba(0,198,111,0.4)]"
                  : "border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent"
              }`}>
              {plan.highlight && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00C66F]/50 to-transparent" />}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="pg-display text-3xl text-white">{p.name}</h2>
                  {plan.highlight && (
                    <span className="text-[10px] border border-[#00C66F]/30 text-[#00C66F] px-2.5 py-0.5 rounded-lg font-mono bg-[#00C66F]/[0.05]">MOST POPULAR</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500">{plan.tagline}</p>
              </div>

              <div>
                <div className="flex items-end gap-1.5">
                  <span data-price className="pg-display text-5xl md:text-6xl text-white leading-none">{eur(yearly ? p.year : p.month)}</span>
                  <span className="text-zinc-500 text-base mb-1">{yearly ? "/year" : "/month"}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  {yearly
                    ? <>{eur(Math.round((p.year / 12) * 100) / 100)} a month · <span className="text-[#00C66F]">{monthsFree(plan.id)} months free</span></>
                    : <>or {eur(p.year)}/year — {monthsFree(plan.id)} months free</>}
                </p>
              </div>

              <ul className="space-y-2.5 flex-1 border-t border-white/[0.06] pt-5 text-sm text-zinc-300">
                {plan.points.map((t) => <li key={t} className="flex gap-2.5"><Check />{t}</li>)}
              </ul>

              <button disabled className="w-full py-2.5 px-4 rounded-lg border border-zinc-700 text-zinc-500 text-sm font-medium cursor-not-allowed">
                Not yet available
              </button>
            </div>
          );
        })}

        <div data-plan="business" className="relative rounded-2xl border border-dashed border-white/[0.12] p-6 md:p-7 flex flex-col gap-5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="pg-display text-3xl text-white">Business</h2>
              <span className="text-[10px] border border-zinc-700 text-zinc-400 px-2.5 py-0.5 rounded-lg font-mono">COMING SOON</span>
            </div>
            <p className="text-xs text-zinc-500">For more sites and a team.</p>
          </div>
          <div>
            <div className="pg-display text-3xl md:text-4xl text-zinc-300 leading-none">Let&apos;s talk</div>
            <p className="text-xs text-zinc-500 mt-2">Price per number of sites.</p>
          </div>
          <ul className="space-y-2.5 flex-1 border-t border-white/[0.06] pt-5 text-sm text-zinc-300">
            {BUSINESS.map((t) => <li key={t} className="flex gap-2.5"><Check />{t}</li>)}
          </ul>
          <a href={CONTACT} className="w-full text-center py-2.5 px-4 rounded-lg border border-[#00C66F]/40 text-[#00C66F] text-sm font-medium hover:bg-[#00C66F]/10 transition-colors">
            Contact us
          </a>
        </div>
      </div>

      <p className="text-xs text-zinc-500 -mt-4 md:-mt-6">
        {VAT_NOTE}
      </p>

      <TesterCta />

      {/* Add-on */}
      <div data-plan="addon_connector" className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#00C66F]/60 font-mono">Add-on</div>
          <h3 className="text-white font-medium">{PRICING.addon_connector.name}</h3>
          <p className="text-sm text-zinc-400">One more connector for a Home or Pro site.</p>
        </div>
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span data-price className="pg-display text-3xl text-white">{eur(yearly ? PRICING.addon_connector.year : PRICING.addon_connector.month)}</span>
          <span className="text-zinc-500 text-sm">{yearly ? "/year" : "/month"}</span>
        </div>
      </div>

      {/* Guarantees */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-zinc-500">
        {[
          ["Self-hosted", "Runs on your hardware, not ours"],
          ["Offline-proof", "30-day grace period offline"],
          ["No lock-in", "Protection keeps working if you stop"],
          ["No per-UPS fees", "Flat price per plan"],
        ].map(([title, sub]) => (
          <div key={title} className="rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-transparent p-4 space-y-1">
            <div className="text-zinc-300 font-medium text-sm flex items-center gap-2"><span className="text-[#00C66F]">✓</span> {title}</div>
            <div>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
