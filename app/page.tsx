import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      {/* HERO */}
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <section className="py-10 md:py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              One layer for all your UPS — no vendor lock-in
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1]">
              One control plane for{" "}
              <span className="text-[#00C66F]">UPS &amp; power</span>{" "}
              infrastructure.
            </h1>

            <p className="text-zinc-400 text-lg max-w-xl leading-relaxed">
              Multi-vendor UPS monitoring, safe shutdown rules and OTA updates —
              built on NUT, runs on €30 hardware. Cloud access is optional.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/pricing"
                className="px-6 py-3 rounded-full bg-[#00C66F] text-black text-sm font-semibold hover:bg-[#00b564] transition shadow-[0_0_35px_rgba(0,198,111,0.45)] hover:shadow-[0_0_50px_rgba(0,198,111,0.6)]"
              >
                View Plans →
              </Link>
              <Link
                href="/controller"
                className="px-6 py-3 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
              >
                Explore Controller OS
              </Link>
            </div>

            <div className="flex flex-wrap gap-5 text-xs text-zinc-500 pt-1">
              {[
                "Self-hosted on €30 hardware",
                "NUT · SNMP · USB autodiscovery",
                "From €5/mo",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Hero — high-fidelity dashboard mockup */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent blur-xl" />
            <div className="relative font-mono text-xs bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-zinc-700" />
                    <span className="w-3 h-3 rounded-full bg-zinc-700" />
                    <span className="w-3 h-3 rounded-full bg-zinc-700" />
                  </div>
                  <span className="text-zinc-500 text-[11px] ml-2">PowerGuardian · Dashboard</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  2 connectors online
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "UPS Units", value: "3", sub: "2 online" },
                    { label: "Connectors", value: "2", sub: "active" },
                    { label: "Alerts", value: "1", sub: "critical", alert: true },
                  ].map((s) => (
                    <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                      <div className="text-[10px] text-zinc-500 mb-1">{s.label}</div>
                      <div className={`text-xl font-bold ${s.alert ? "text-red-400" : "text-white"}`}>{s.value}</div>
                      <div className={`text-[10px] ${s.alert ? "text-red-500" : "text-zinc-500"}`}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* UPS cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-200 font-semibold text-[11px]">Main UPS</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">OL</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Battery</span>
                        <span className="text-emerald-400">98%</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{width:"98%"}} />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Load</span><span className="text-zinc-300">42%</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-500 rounded-full" style={{width:"42%"}} />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Runtime</span><span className="text-zinc-300">120 min</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-red-300 font-semibold text-[11px]">Backup UPS</span>
                      <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">OB LB</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Battery</span>
                        <span className="text-red-400">14%</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{width:"14%"}} />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Load</span><span className="text-red-400">89%</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{width:"89%"}} />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Runtime</span><span className="text-red-400">8 min ⚠</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event log */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5 space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Recent Events</div>
                  {[
                    { time: "09:14", msg: "Backup UPS battery critical — shutdown queued", color: "text-red-400" },
                    { time: "09:12", msg: "nas-01.local shutdown executed via SSH", color: "text-amber-400" },
                    { time: "09:10", msg: "rack-02.local connected", color: "text-emerald-400" },
                  ].map((e) => (
                    <div key={e.time} className="flex gap-2 text-[10px]">
                      <span className="text-zinc-600 shrink-0">{e.time}</span>
                      <span className={e.color}>{e.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* INTEGRATIONS BAR */}
      <section className="py-6 border-y border-zinc-800/50 bg-zinc-950/40">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
            <span className="text-xs text-zinc-600 uppercase tracking-widest shrink-0">Works with</span>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-6">
              {["APC", "Eaton", "CyberPower", "Tripp Lite", "Vertiv", "Generic HID"].map((brand) => (
                <span key={brand} className="text-sm font-semibold text-zinc-600 hover:text-zinc-400 transition-colors">
                  {brand}
                </span>
              ))}
            </div>
            <div className="sm:ml-auto text-xs text-zinc-600 shrink-0">50+ UPS models via NUT</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 md:py-24 mx-auto max-w-6xl px-4 md:px-6">
        <div className="text-center space-y-3 mb-12">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">How it works</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Up and running in three steps</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3 relative">
          <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-px bg-gradient-to-r from-zinc-800 via-[#00C66F]/30 to-zinc-800" />
          {[
            {
              step: "01",
              title: "Deploy Controller OS",
              body: "Flash Controller OS to a NanoPi R3S or run it as a VM. First-boot wizard sets up admin and network in minutes.",
            },
            {
              step: "02",
              title: "Connect your UPS",
              body: "Install the Connector OS on any machine with a UPS. It auto-discovers USB, SNMP and NMC cards and registers itself.",
            },
            {
              step: "03",
              title: "Monitor & automate",
              body: "Adopt connectors in the dashboard, define shutdown sequences per host, and let the rule engine do the rest.",
            },
          ].map((s) => (
            <div key={s.step} className="relative bg-zinc-950/70 border border-zinc-800 rounded-xl p-6 space-y-3">
              <div className="text-4xl font-bold text-zinc-800 select-none">{s.step}</div>
              <h3 className="text-base font-semibold text-white">{s.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONNECTOR VS CONTROLLER */}
      <section className="py-4 md:py-6 mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          <ProductCard
            label="Edge agent"
            title="Connector OS"
            description="Runs next to your UPS. Autodetects USB, SNMP and network cards, and executes local shutdown rules when the controller is unreachable."
            bullets={[
              "NUT under the hood, fully preconfigured",
              "UPS identify (beep), autodetected drivers & capabilities",
              "Local rules for NAS, hypervisors and switches",
              "OTA updates from Controller, signed per release",
            ]}
            href="/connector"
          />
          <ProductCard
            label="Control plane"
            title="Controller OS"
            description="Your central dashboard for power. Adopt connectors, map UPS devices to hosts and racks, and define power-down sequences per site."
            bullets={[
              "Zero-touch adoption for new connectors",
              "Inventory + shutdown mapping per server and rack",
              "Credential vault, MFA-ready, role-based access",
              "Backups, Google Drive sync and optional cloud proxy",
            ]}
            href="/controller"
          />
        </div>
      </section>

      {/* CAPABILITIES GRID */}
      <section className="py-20 md:py-24 mx-auto max-w-6xl px-4 md:px-6 space-y-8">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Capabilities</div>
            <h2 className="text-2xl font-semibold tracking-tight">Built for real infrastructure</h2>
          </div>
          <span className="text-xs text-zinc-600 hidden md:block">
            Homelabs · small business racks · multi-site
          </span>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <CapabilityCard
            icon={<IconScan />}
            accent="emerald"
            title="Discovery &amp; Network"
            body="Scan USB, SNMP and NMC cards to detect model, runtime and battery status without manual driver hunting."
            bullets={[
              "UPS autodiscovery over USB, SNMP and NMC",
              "Dual-NIC VLAN-aware management plane",
            ]}
          />
          <CapabilityCard
            icon={<IconShield />}
            accent="blue"
            title="Protection &amp; Security"
            body="Define shutdown sequences per host and rack. Store all credentials in an encrypted vault — no passwords in config files."
            bullets={[
              "Rule-based shutdown with priority ordering",
              "Encrypted vault for SNMP, SSH and API tokens",
            ]}
          />
          <CapabilityCard
            icon={<IconUpdates />}
            accent="amber"
            title="Updates &amp; Distribution"
            body="Push signed OTA updates to every connector from the Controller. One-click upgrades, no manual SSH, no version drift."
            bullets={[
              "Signed OTA packages with anti-cloning checks",
              "Controller serves images to all connected nodes",
            ]}
          />
        </div>
      </section>

      {/* WHY NOT JUST A VENDOR CARD */}
      <section className="py-16 md:py-20 mx-auto max-w-6xl px-4 md:px-6">
        <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800 p-8 md:p-10 space-y-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Why PowerGuardian</div>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Not just another SNMP card</h2>
          </div>
          <p className="text-zinc-300 text-sm md:text-base max-w-3xl leading-relaxed">
            A vendor SNMP card protects one UPS, one stack, one brand. PowerGuardian
            runs on open NUT protocols and orchestrates every UPS across all your racks
            in one place — shutdown sequences, credentials and VLAN segmentation
            included. Your hardware, your data, your rules.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Multi-vendor",
                body: "Eaton, APC and generic HID UPS: all visible in one dashboard and rule engine.",
              },
              {
                title: "Infra-aware",
                body: "Map UPS devices to hosts, clusters and VLANs — not just IP addresses.",
              },
              {
                title: "Future-ready",
                body: "Push signed OTA updates to every connector from the Controller. No manual SSH, no version drift.",
              },
            ].map((c) => (
              <div key={c.title} className="border-l-2 border-[#00C66F]/40 pl-4 space-y-1">
                <div className="text-sm font-semibold text-zinc-200">{c.title}</div>
                <p className="text-xs text-zinc-500 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="py-4 md:py-6 mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Homelab",
              text: "One UPS, one Connector, one Controller VM. Clean shutdown for your NAS, hypervisor and router without manual scripting.",
            },
            {
              title: "Small business rack",
              text: "Multiple UPS units across a single rack. Map each UPS to critical and non-critical systems with staged shutdown.",
            },
            {
              title: "Multi-site",
              text: "Connectors in different locations feeding one central Controller OS, accessible over secure VPN or dedicated management network.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-2 hover:border-zinc-700 transition-colors">
              <h3 className="text-sm font-semibold text-white">{c.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ + CTA */}
      <section className="py-20 md:py-28 mx-auto max-w-6xl px-4 md:px-6 grid gap-10 md:grid-cols-[3fr,2fr] items-start">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">FAQ</div>
          {[
            {
              q: "Do I need internet access for PowerGuardian?",
              a: "No. PowerGuardian runs fully on your own hardware, always. Internet is optional — add cloud for remote access and license sync. Air-gapped setups work with a 30-day grace period.",
            },
            {
              q: "Which UPS brands are supported?",
              a: "PowerGuardian builds on NUT, so many APC, Eaton and generic HID UPS devices work out of the box. The goal is to publish a clear compatibility list over time.",
            },
            {
              q: "Can I run the controller in a VM?",
              a: "Yes. Controller OS can run on a NanoPi R3S, a dedicated x86 box or as a VM / Docker container in your homelab or rack.",
            },
            {
              q: "What happens if the controller is down?",
              a: "Connectors keep running local rules. Buffered events sync back to the controller once connectivity is restored.",
            },
          ].map((f) => (
            <div key={f.q} className="border-b border-zinc-800/80 pb-5 pt-3 space-y-1.5">
              <div className="text-sm font-medium text-zinc-100">{f.q}</div>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="sticky top-8 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-7 space-y-5">
          <h3 className="text-xl font-semibold tracking-tight leading-tight">
            Ready to clean up your power stack?
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Start with a single UPS, one Connector and one Controller instance.
            Grow from a homelab to a full rack — without changing tools.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/pricing"
              className="w-full text-center px-6 py-3 rounded-full bg-[#00C66F] text-black text-sm font-semibold hover:bg-[#00b564] transition shadow-[0_0_35px_rgba(0,198,111,0.45)] hover:shadow-[0_0_50px_rgba(0,198,111,0.6)]"
            >
              View Plans &amp; Pricing →
            </Link>
            <Link
              href="/docs"
              className="w-full text-center px-6 py-3 rounded-full border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition"
            >
              Read the docs
            </Link>
          </div>
          <p className="text-[11px] text-zinc-600 text-center">From €5/month · cancel anytime</p>
        </div>
      </section>
    </div>
  );
}

/* ── SVG Icon components ─────────────────────────────────────────── */

function IconScan() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}

function IconUpdates() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}

/* ── Helper components ───────────────────────────────────────────── */

function CapabilityCard(props: {
  icon: React.ReactNode;
  accent: "emerald" | "blue" | "amber";
  title: string;
  body: string;
  bullets: string[];
}) {
  const accentMap = {
    emerald: { border: "border-l-emerald-500", icon: "text-emerald-400 bg-emerald-500/10", bullet: "text-emerald-500" },
    blue:    { border: "border-l-blue-500",    icon: "text-blue-400 bg-blue-500/10",       bullet: "text-blue-500"    },
    amber:   { border: "border-l-amber-500",   icon: "text-amber-400 bg-amber-500/10",     bullet: "text-amber-500"   },
  };
  const a = accentMap[props.accent];
  return (
    <div className={`bg-zinc-950/70 border border-zinc-800 border-l-2 ${a.border} rounded-xl p-6 space-y-4`}>
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${a.icon}`}>
        {props.icon}
      </div>
      <h3 className="text-base font-semibold text-white" dangerouslySetInnerHTML={{ __html: props.title }} />
      <p className="text-sm text-zinc-400 leading-relaxed">{props.body}</p>
      <ul className="space-y-1.5 text-xs text-zinc-500">
        {props.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className={`mt-0.5 ${a.bullet}`}>→</span>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductCard(props: {
  label: string;
  title: string;
  description: string;
  bullets: string[];
  href: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4 hover:border-zinc-700 transition-colors">
      <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{props.label}</div>
      <h3 className="text-xl font-semibold">{props.title}</h3>
      <p className="text-sm text-zinc-300 leading-relaxed">{props.description}</p>
      <ul className="space-y-2 text-sm text-zinc-400">
        {props.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#00C66F] shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href={props.href}
        className="inline-flex items-center gap-1.5 text-xs text-[#00C66F] hover:text-[#1af189] transition-colors mt-2"
      >
        Open {props.title} <span>↗</span>
      </Link>
    </div>
  );
}
