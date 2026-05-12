import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="pt-12 pb-16 md:pt-16 md:pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
            UPS orchestration.<br />
            <span className="text-[#00C66F]">Your hardware.</span><br />
            Your rules.
          </h1>
          <p className="text-zinc-400 text-base max-w-lg leading-relaxed">
            PowerGuardian replaces scattered NUT configs and manual shutdown
            scripts with a single control plane — self-hosted, hardware-agnostic,
            offline-capable. Built for homelabs and server rooms that can't
            afford unplanned downtime.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/pricing"
              className="px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-semibold hover:bg-[#00b564] transition shadow-[0_0_24px_rgba(0,198,111,0.4)]"
            >
              View pricing
            </Link>
            <Link
              href="/docs"
              className="px-5 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition"
            >
              Documentation →
            </Link>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative">
          <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-zinc-700/40 to-transparent pointer-events-none" />
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
              <span className="text-zinc-500 text-[11px]">PowerGuardian · Dashboard</span>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                2 connectors online
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "UPS Units",    v: "3",  s: "2 online",   c: "" },
                  { l: "Connectors",  v: "2",  s: "active",     c: "" },
                  { l: "Alerts",      v: "1",  s: "critical",   c: "text-red-400" },
                ].map(s => (
                  <div key={s.l} className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-zinc-600 mb-1">{s.l}</div>
                    <div className={`text-lg font-bold ${s.c || "text-white"}`}>{s.v}</div>
                    <div className={`text-[10px] ${s.c || "text-zinc-500"}`}>{s.s}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <UPSCard name="Main UPS" status="OL" battery={98} load={42} runtime="120 min" ok />
                <UPSCard name="Backup UPS" status="OB LB" battery={14} load={89} runtime="8 min ⚠" ok={false} />
              </div>
              <div className="border border-zinc-800 rounded-lg px-3 py-2 space-y-1.5">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Events</div>
                {[
                  { t: "09:14", m: "Backup UPS battery critical — shutdown queued", c: "text-red-400" },
                  { t: "09:12", m: "nas-01 shutdown via SSH",                       c: "text-amber-400" },
                  { t: "09:10", m: "rack-02.local connected",                       c: "text-emerald-400" },
                ].map(e => (
                  <div key={e.t} className="flex gap-2 text-[10px]">
                    <span className="text-zinc-700 w-8 shrink-0">{e.t}</span>
                    <span className={e.c}>{e.m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPAT BAR ───────────────────────────────────────────── */}
      <div className="border-t border-b border-zinc-800/60 py-4 mb-16">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-8">
          <span className="text-[11px] text-zinc-600 uppercase tracking-widest shrink-0">Works with</span>
          <div className="flex flex-wrap justify-center gap-6">
            {["APC","Eaton","CyberPower","Tripp Lite","Vertiv","Generic HID"].map(b => (
              <span key={b} className="text-sm font-medium text-zinc-600">{b}</span>
            ))}
          </div>
          <span className="sm:ml-auto text-[11px] text-zinc-600 shrink-0">via NUT · SNMP RFC 1628</span>
        </div>
      </div>

      {/* ── ARCHITECTURE ─────────────────────────────────────────── */}
      <section className="pb-16 md:pb-20 grid md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Architecture</div>
          <h2 className="text-2xl font-semibold tracking-tight">Two components. One control plane.</h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
            A <strong className="text-zinc-300">Connector</strong> sits next to each UPS and handles low-level communication
            — USB, SNMP, NMC. A <strong className="text-zinc-300">Controller</strong> aggregates all connectors,
            runs the rule engine, and exposes the dashboard. Both components run on
            your hardware. The Controller can optionally proxy through cloud for remote access.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/connector" className="text-sm text-[#00C66F] hover:text-[#1af189] transition">Connector OS →</Link>
            <Link href="/controller" className="text-sm text-zinc-400 hover:text-white transition">Controller OS →</Link>
          </div>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {[
            { label: "Controller OS", sub: "Dashboard · rule engine · credential vault", badge: "NanoPi R3S", active: true },
            { label: null },
            { label: "Connector OS", sub: "NUT agent · USB/SNMP · local rule execution", badge: "NanoPi Neo3", active: false },
            { label: null },
            { label: "UPS device", sub: "APC / Eaton / CyberPower / Generic HID", badge: "Hardware", active: false },
          ].map((row, i) => row.label === null ? (
            <div key={i} className="flex items-center gap-2 py-1">
              <div className="w-4" />
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-px h-3 bg-zinc-700" />
                <div className="text-[9px] text-zinc-600 tracking-widest uppercase">WebSocket</div>
                <div className="w-px h-3 bg-zinc-700" />
              </div>
            </div>
          ) : (
            <div key={i} className={`flex items-center justify-between border rounded-lg px-4 py-3 ${row.active ? "border-[#00C66F]/30 bg-[#00C66F]/5" : "border-zinc-800 bg-zinc-950/60"}`}>
              <div>
                <div className={`font-semibold ${row.active ? "text-[#00C66F]" : "text-zinc-300"}`}>{row.label}</div>
                <div className="text-zinc-600 text-[10px] mt-0.5">{row.sub}</div>
              </div>
              <span className="text-[10px] border border-zinc-700 rounded px-2 py-0.5 text-zinc-500">{row.badge}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CAPABILITIES ─────────────────────────────────────────── */}
      <section className="pb-16 md:pb-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Capabilities</div>
            <h2 className="text-2xl font-semibold tracking-tight">Everything the rule book missed</h2>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              title: "Multi-vendor UPS support",
              body: "Built on NUT. Any UPS with a NUT driver works — USB HID, SNMP v1/v2c/v3, and vendor network cards. No recompilation, no custom drivers.",
              tags: ["USB HID", "SNMP v1/v2c", "NMC"],
            },
            {
              title: "Offline-first rule engine",
              body: "Shutdown rules are pushed to each Connector and execute locally. If the controller is unreachable, the Connector acts independently. No cloud dependency on the critical path.",
              tags: ["Local execution", "No SPOF", "Buffered sync"],
            },
            {
              title: "Staged shutdown sequences",
              body: "Define which hosts shut down at what battery threshold and in what order. Non-critical VMs first, storage last. Fully configurable per site.",
              tags: ["Priority ordering", "Per-threshold", "SSH + NUT"],
            },
            {
              title: "Encrypted credential vault",
              body: "SNMP community strings, SSH keys and API tokens are stored in an AES-256-GCM vault. Never in plaintext config files. Unlock with MFA.",
              tags: ["AES-256-GCM", "MFA-protected", "TOFU"],
            },
            {
              title: "Signed OTA updates",
              body: "Push Debian packages to all connectors from the Controller dashboard. Package signatures are verified before installation. No manual SSH required.",
              tags: ["SHA-256 verified", "One-click deploy", "Rollback ready"],
            },
            {
              title: "VLAN-aware networking",
              body: "Controller OS understands VLAN-tagged traffic. Keep your power-management plane cleanly segmented from general LAN traffic on a single physical port.",
              tags: ["802.1Q", "Dual-NIC", "Management VLAN"],
            },
          ].map(c => (
            <div key={c.title} className="border border-zinc-800 bg-zinc-950/50 rounded-lg p-5 space-y-3 hover:border-zinc-700 transition-colors">
              <h3 className="text-sm font-semibold text-white">{c.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{c.body}</p>
              <div className="flex flex-wrap gap-1.5">
                {c.tags.map(t => (
                  <span key={t} className="text-[10px] border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING TEASER ───────────────────────────────────────── */}
      <section className="pb-20 md:pb-28 border border-zinc-800 rounded-lg p-8 md:p-10">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Pricing</div>
            <h2 className="text-2xl font-semibold tracking-tight">Simple. No per-device fees.</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Licensing covers cloud access and updates. The software runs on your
              hardware indefinitely — no metered metrics, no feature paywalls,
              no per-UPS charges.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-300">Home</span>
                <span className="text-zinc-400">€4.99/mo · 1 connector</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-300">Pro</span>
                <span className="text-zinc-400">€14.99/mo · 5 connectors</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-zinc-300">Enterprise</span>
                <span className="text-zinc-400">Custom · contact us</span>
              </div>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-semibold hover:bg-[#00b564] transition shadow-[0_0_24px_rgba(0,198,111,0.35)]"
            >
              See full pricing →
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            {[
              "Self-hosted — runs on your hardware, not ours",
              "Air-gapped setups supported (30-day grace period)",
              "Cancel anytime — software keeps working",
              "No per-UPS or per-device metering",
              "Annual billing saves ~25%",
            ].map(f => (
              <div key={f} className="flex items-start gap-3 text-zinc-400">
                <span className="text-[#00C66F] mt-0.5 shrink-0">✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

/* ── Inline sub-components ───────────────────────────────────────── */

function UPSCard({ name, status, battery, load, runtime, ok }: {
  name: string; status: string; battery: number; load: number; runtime: string; ok: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${ok ? "border-zinc-800 bg-zinc-900/60" : "border-red-900/40 bg-red-950/20"}`}>
      <div className="flex justify-between items-center">
        <span className={`font-semibold text-[11px] ${ok ? "text-zinc-200" : "text-red-300"}`}>{name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ok ? "border-emerald-800 text-emerald-400 bg-emerald-950/30" : "border-red-800 text-red-400 bg-red-950/30"}`}>{status}</span>
      </div>
      {[
        { label: "Battery", value: `${battery}%`, pct: battery, ok },
        { label: "Load",    value: `${load}%`,    pct: load,    ok: load < 80 },
      ].map(r => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-600">{r.label}</span>
            <span className={r.ok ? "text-zinc-300" : "text-red-400"}>{r.value}</span>
          </div>
          <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${r.ok ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${r.pct}%` }} />
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[10px]">
        <span className="text-zinc-600">Runtime</span>
        <span className={ok ? "text-zinc-300" : "text-red-400"}>{runtime}</span>
      </div>
    </div>
  );
}
