// app/connector/page.tsx
import Image from "next/image";
import Link from "next/link";

export default function ConnectorPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="grid gap-8 md:grid-cols-[3fr,2fr] items-start">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Connector OS
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            The edge agent that lives<br className="hidden md:block" /> next to your UPS.
          </h1>
          <p className="text-sm md:text-base text-zinc-400 max-w-xl leading-relaxed">
            Connector OS is a lightweight OS image you flash onto a small board
            and place near each UPS. It handles all low-level communication —
            USB, SNMP, or network cards — and acts as an always-on buffer between
            your UPS and the Controller.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/pricing"
              className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[var(--pg-cta-shadow)]"
            >
              Get a License →
            </Link>
            <Link
              href="/controller"
              className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
            >
              See Controller OS →
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">
            Reference hardware
          </div>
          <Image
            src="/neo3.png"
            alt="NanoPi Neo3 board"
            width={420}
            height={260}
            className="rounded-xl shadow-2xl"
          />
          <p className="text-xs text-zinc-500 text-center max-w-xs">
            NanoPi Neo3 — €30, passively cooled, 2 GB RAM, USB 3.0.
            Runs Connector OS 24/7 next to a single UPS.
          </p>
        </div>
      </section>

      {/* What it does */}
      <section className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">What Connector OS does</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-2">
            <div className="text-[#00C66F] text-lg font-bold">01</div>
            <h3 className="text-sm font-semibold text-white">Talk to the UPS</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Connects via USB, SNMP, or vendor network card. Built on NUT
              (Network UPS Tools) — the open standard that supports hundreds
              of UPS models from APC, Eaton, CyberPower, Riello and more.
              No proprietary drivers required.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-2">
            <div className="text-[#00C66F] text-lg font-bold">02</div>
            <h3 className="text-sm font-semibold text-white">Buffer and act locally</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Power events (on battery, low battery, overload) are processed
              locally. If the Controller is unreachable, the Connector still
              executes its shutdown rules independently. No cloud dependency,
              no single point of failure.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-2">
            <div className="text-[#00C66F] text-lg font-bold">03</div>
            <h3 className="text-sm font-semibold text-white">Sync to Controller</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When the Controller is online, the Connector streams metrics,
              events and status continuously. This feeds the dashboards,
              alert rules and audit logs that live on the Controller side.
            </p>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Capabilities</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> USB, SNMP v1/v2c/v3 and network card support</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Local rule execution — no controller needed</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Signed OTA updates pushed from Controller OS</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Secure adoption token — zero-touch onboarding</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Anti-cloning check — one token, one connector</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Encrypted tunnel to Controller</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Persistent local event log (survives reboots)</li>
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            Hardware it runs on
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Connector OS runs on the{" "}
            <span className="text-zinc-300 font-medium">NanoPi Neo3</span> —
            small, silent, and built for 24/7 duty next to a UPS. At €30 it is
            the most cost-effective way to add a dedicated edge agent per UPS.
          </p>
          <div className="flex items-center gap-2 text-sm mt-2">
            <span className="text-[#00C66F]">●</span>
            <span className="font-medium text-zinc-300">NanoPi Neo3</span>
            <span className="text-zinc-600 text-xs">— only supported platform right now</span>
          </div>
          <p className="text-xs text-zinc-600 pt-2">
            More platforms coming — follow the{" "}
            <a href="/roadmap" className="underline hover:text-zinc-400 transition">roadmap</a>{" "}
            for updates.
          </p>
        </div>
      </section>

      {/* Architecture relationship */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
        <h2 className="text-base font-semibold tracking-tight">How Connector fits into the full picture</h2>
        <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
          Each Connector OS instance manages one or more UPS devices at a single
          location. One or more Connectors report into a single Controller OS, which
          provides the unified view, rule management and remote access. You can have
          many connectors spread across multiple sites — the Controller handles the
          aggregation.
        </p>
        <div className="grid gap-3 md:grid-cols-3 text-xs text-zinc-500">
          <div className="rounded-lg border border-zinc-800 p-3 space-y-1">
            <div className="text-zinc-300 font-medium">Small homelab</div>
            <div>1 Connector next to 1 UPS → 1 Controller on the same LAN.</div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3 space-y-1">
            <div className="text-zinc-300 font-medium">Server room</div>
            <div>3–4 Connectors per rack row → single Controller with multi-UPS dashboard.</div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3 space-y-1">
            <div className="text-zinc-300 font-medium">Multi-site</div>
            <div>Connectors at remote sites relay through cloud proxy → one Controller across all locations.</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-xl border border-[#00C66F]/20 bg-[#00C66F]/5 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-white">Ready to deploy your first connector?</div>
          <div className="text-xs text-zinc-400">Pick a plan, flash the image, and adopt it from Controller OS in minutes.</div>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            href="/pricing"
            className="px-5 py-2 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[var(--pg-cta-shadow)]"
          >
            View Plans →
          </Link>
          <Link
            href="/controller"
            className="px-5 py-2 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
          >
            Controller OS
          </Link>
        </div>
      </section>
    </div>
  );
}
