// app/controller/page.tsx
import Link from "next/link";

export default function ControllerPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Controller OS
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          The central control plane<br className="hidden md:block" /> for your power layer.
        </h1>
        <p className="text-sm md:text-base text-zinc-400 max-w-2xl leading-relaxed">
          Controller OS is where everything comes together. It adopts your
          Connectors, maps UPS devices to hosts and racks, runs the rule engine
          for staged shutdowns, and gives you a single dashboard across all
          sites and all UPS devices — running entirely on your own hardware.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/pricing"
            className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[var(--pg-cta-shadow)]"
          >
            Get a License →
          </Link>
          <Link
            href="/connector"
            className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
          >
            See Connector OS →
          </Link>
        </div>
      </section>

      {/* What it does */}
      <section className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">What Controller OS does</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-2">
            <div className="text-[#00C66F] text-lg font-bold">01</div>
            <h3 className="text-sm font-semibold text-white">Adopt &amp; manage connectors</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Connectors register with a secure one-time token. Once adopted,
              you assign them to sites, racks, and UPS devices from a single
              place. Add, remove or update connectors without touching the
              command line.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-2">
            <div className="text-[#00C66F] text-lg font-bold">02</div>
            <h3 className="text-sm font-semibold text-white">Map power to infrastructure</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Link UPS devices to the hosts and services they power. Define
              which systems are critical, which are sacrificial, and in what
              order they should shut down when runtime gets low.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-2">
            <div className="text-[#00C66F] text-lg font-bold">03</div>
            <h3 className="text-sm font-semibold text-white">Run the rule engine</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Set threshold-based rules: when UPS battery drops below X%, run
              this shutdown sequence in this order. Rules can be global or
              per-site, and are pushed to the relevant Connectors automatically.
            </p>
          </div>
        </div>
      </section>

      {/* Core capabilities */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Capabilities</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Zero-touch connector adoption with secure tokens</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Multi-site dashboard — all UPS in one view</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Rule engine for staged, ordered shutdown sequences</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Encrypted credential vault (SNMP, SSH, APIs)</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> OTA updates — push signed packages to all connectors</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Role-based access: admin, operator, viewer</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Optional cloud proxy for remote access</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Automated backups to Google Drive</li>
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            Where to run it
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Controller OS runs on the NanoPi R3S as the primary reference board,
            but any x86 box, VM, or container works too. The key design principle:
            it should run independently of your main hypervisor, so a power event
            doesn't take down the Controller before the shutdown is complete.
          </p>
          <div className="space-y-1 text-sm text-zinc-400 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[#00C66F]">●</span>
              <span className="font-medium text-zinc-300">NanoPi R3S</span>
              <span className="text-zinc-600 text-xs">— primary platform</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">○</span>
              <span>Dedicated x86 mini PC or server</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">○</span>
              <span>Out-of-band VM (on a separate hypervisor or UPS)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">○</span>
              <span>LXC container or Docker (advanced setups)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rule engine detail */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
        <h2 className="text-base font-semibold tracking-tight">
          Rules and shutdown mapping
        </h2>
        <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
          Instead of a simple UPS → IP mapping, Controller OS lets you think in
          terms of racks, hosts and services. Define which systems are critical,
          which can go first, and at what battery level each stage kicks in.
        </p>
        <div className="grid gap-3 md:grid-cols-3 text-xs text-zinc-500">
          <div className="rounded-lg border border-zinc-800 p-3 space-y-1">
            <div className="text-zinc-300 font-medium">Homelab</div>
            <div>Prioritize router and hypervisor. Gracefully shut down NAS and lab VMs first.</div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3 space-y-1">
            <div className="text-zinc-300 font-medium">Small business rack</div>
            <div>Keep core services and primary storage alive longer than dev boxes and non-critical systems.</div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3 space-y-1">
            <div className="text-zinc-300 font-medium">Multi-UPS environment</div>
            <div>Different shutdown policies per UPS and per site, all visible from one dashboard.</div>
          </div>
        </div>
      </section>

      {/* Network & security */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-base font-semibold tracking-tight">VLAN &amp; network design</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Controller OS understands VLAN-tagged traffic, so you can keep your
            power-control layer cleanly segmented without needing extra hardware.
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li className="flex gap-2">
              <span className="text-zinc-300 font-medium shrink-0">Simple mode:</span>
              <span>LAN1 on your main LAN — Connectors and UPS management cards discovered automatically.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-300 font-medium shrink-0">VLAN-aware:</span>
              <span>Tagged and untagged traffic on one port from your switch.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-300 font-medium shrink-0">Dual-NIC:</span>
              <span>LAN1 for your regular network, LAN2 for an isolated UPS/IoT segment.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Security model</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Encrypted credential vault for all secrets</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Role-based access: admin, operator, viewer</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> SSH access policy per role and per connector</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Node tokens with anti-cloning checks</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> Signed OTA packages — no unsigned updates</li>
            <li className="flex gap-2"><span className="text-[#00C66F] shrink-0">✓</span> All data stays on your hardware by default</li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-xl border border-[#00C66F]/20 bg-[#00C66F]/5 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-white">One control plane for your entire power layer.</div>
          <div className="text-xs text-zinc-400">Pick a plan and start managing UPS devices across every site.</div>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            href="/pricing"
            className="px-5 py-2 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[var(--pg-cta-shadow)]"
          >
            View Plans →
          </Link>
          <Link
            href="/connector"
            className="px-5 py-2 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
          >
            Connector OS
          </Link>
        </div>
      </section>
    </div>
  );
}
