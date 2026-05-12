import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Controller OS",
  description: "Centralized UPS management: adopt connectors, run staged shutdowns, and manage your full power layer from one dashboard.",
};

export default function ControllerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 pt-12 pb-20 space-y-14">

      {/* Hero */}
      <section className="space-y-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Controller OS</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.15]">
          The central control plane<br /> for your power layer.
        </h1>
        <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
          Controller OS adopts your Connectors, maps UPS devices to hosts, runs the staged-shutdown
          rule engine, and provides a unified dashboard across all sites. Runs entirely on your own
          hardware. No SaaS control plane required.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/pricing"
            className="px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-semibold hover:bg-[#00b564] transition shadow-[0_0_24px_rgba(0,198,111,0.4)]"
          >
            View pricing
          </Link>
          <Link
            href="/connector"
            className="px-5 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            Connector OS →
          </Link>
        </div>
      </section>

      {/* Core functions */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Core functions</div>
          <h2 className="text-xl font-semibold tracking-tight">What Controller OS does</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Adopt & manage connectors",
              body: "Connectors register with a secure one-time token. Once adopted, assign them to sites and UPS devices from a single interface. Add, remove or update connectors without touching the command line.",
              tags: ["TOFU token", "Zero-touch", "Revoke + re-adopt"],
            },
            {
              n: "02",
              title: "Map power to infrastructure",
              body: "Link UPS devices to the hosts and services they power. Define priority order: which systems are critical, which are sacrificial, and at what battery threshold each shutdown stage kicks in.",
              tags: ["Priority ordering", "Per-threshold", "SSH + NUT"],
            },
            {
              n: "03",
              title: "Run the rule engine",
              body: "Threshold-based alert rules fire confirmations before triggering. Rules can push shutdown sequences to Connectors automatically. Automation flows add SSH steps, WoL, webhooks, and email actions.",
              tags: ["Confirmation window", "Push to connector", "Automation flows"],
            },
          ].map(c => (
            <div key={c.n} className="border border-zinc-800 bg-zinc-950/50 rounded-lg p-5 space-y-3">
              <div className="text-[#00C66F] font-mono text-sm font-bold">{c.n}</div>
              <h3 className="text-sm font-semibold text-white">{c.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{c.body}</p>
              <div className="flex flex-wrap gap-1.5">
                {c.tags.map(t => (
                  <span key={t} className="text-[10px] border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded font-mono">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities + Hardware */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Capabilities</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            {[
              "Zero-touch connector adoption with secure tokens",
              "Multi-site dashboard — all UPS in one view",
              "Staged, ordered shutdown sequences",
              "AES-256-GCM encrypted credential vault",
              "X25519 ECDH end-to-end payload encryption",
              "Signed OTA packages pushed to all connectors",
              "Role-based access: Owner / Admin / Viewer",
              "TOTP MFA for vault and admin operations",
              "Dynamic DNS — 29 providers, background sync",
              "Google Drive backup scheduler",
              "VLAN-aware networking (802.1Q)",
              "Optional cloud proxy for remote access",
            ].map(f => (
              <li key={f} className="flex gap-2">
                <span className="text-[#00C66F] shrink-0">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Reference hardware</h2>
            <div className="font-mono text-xs space-y-2 text-zinc-500">
              {[
                ["Model",    "NanoPi R3S"],
                ["SoC",      "RK3568 · ARM64"],
                ["RAM",      "2 GB LPDDR4"],
                ["Storage",  "eMMC (no SD card wear)"],
                ["Ports",    "USB 3.0 · 2× GbE"],
                ["OS",       "Debian 12 Bookworm"],
                ["Price",    "~€50"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-zinc-800/60 pb-1.5">
                  <span>{k}</span><span className="text-zinc-300">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Deployment requirements</h2>
            <div className="flex flex-wrap gap-2">
              {["Debian 12 Bookworm", "NanoPi R3S", "eMMC storage", "LAN access", "Caddy reverse proxy", "systemd"].map(r => (
                <span key={r} className="text-[10px] border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded font-mono">{r}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VLAN & security */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">VLAN & network design</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Controller OS understands VLAN-tagged traffic, so you can keep your
            power-control layer cleanly segmented without extra hardware.
          </p>
          <div className="space-y-3 text-xs">
            {[
              { label: "Simple mode",   desc: "LAN1 on your main LAN. Connectors and UPS management cards discovered automatically." },
              { label: "VLAN-aware",    desc: "Tagged and untagged traffic on one port from your switch (802.1Q)." },
              { label: "Dual-NIC",      desc: "LAN1 for your regular network. LAN2 for an isolated UPS/IoT management segment." },
            ].map(r => (
              <div key={r.label} className="flex gap-3">
                <span className="text-zinc-300 font-medium shrink-0 w-24">{r.label}</span>
                <span className="text-zinc-500">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Security model</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            {[
              "AES-256-GCM vault — all secrets encrypted at rest",
              "MFA-protected vault unlock (TOTP + backup codes)",
              "Role-based access control (Owner / Admin / Viewer)",
              "Connector tokens with hardware fingerprint binding",
              "SSH command whitelist on executor (no free-form exec)",
              "TOFU host key pinning for SSH shutdown targets",
              "Signed OTA packages — SHA-256 verified before install",
              "1 MB request body limit, CSP hardened frontend",
            ].map(f => (
              <li key={f} className="flex gap-2">
                <span className="text-[#00C66F] shrink-0">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Shutdown mapping scenarios */}
      <section className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Shutdown mapping scenarios</div>
        <div className="grid gap-3 md:grid-cols-3 text-xs">
          {[
            {
              label: "Homelab",
              desc: "Prioritize router and hypervisor. Shut down NAS and lab VMs at 40% battery, hypervisor at 20%.",
            },
            {
              label: "Small business rack",
              desc: "Keep core services and primary storage alive longer than dev boxes and non-critical systems.",
            },
            {
              label: "Multi-UPS environment",
              desc: "Different shutdown policies per UPS and per site, all visible and configurable from one dashboard.",
            },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-zinc-800 p-4 space-y-1.5">
              <div className="text-zinc-300 font-semibold">{s.label}</div>
              <div className="text-zinc-500 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-lg border border-zinc-800 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-white">One control plane for your entire power layer.</div>
          <div className="text-xs text-zinc-400">Pick a plan and start managing UPS devices across every site.</div>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            href="/pricing"
            className="px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-semibold hover:bg-[#00b564] transition shadow-[0_0_24px_rgba(0,198,111,0.35)]"
          >
            View pricing
          </Link>
          <Link
            href="/connector"
            className="px-5 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            Connector OS →
          </Link>
        </div>
      </section>

    </div>
  );
}
