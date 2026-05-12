import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connector OS",
  description: "Lightweight edge agent for Linux machines, supporting USB, SNMP, and NUT communication on NanoPi Neo3 hardware.",
};

export default function ConnectorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 pt-12 pb-20 space-y-14">

      {/* Hero */}
      <section className="grid gap-10 lg:grid-cols-[3fr,2fr] items-start">
        <div className="space-y-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Connector OS</div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.15]">
            The edge agent that lives<br /> next to your UPS.
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            Connector OS is a lightweight image you flash onto a small board placed near each UPS.
            It handles all low-level communication — USB HID, SNMP, or network management cards —
            and acts as an always-on, offline-capable buffer between your hardware and the Controller.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/pricing"
              className="px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-semibold hover:bg-[#00b564] transition shadow-[0_0_24px_rgba(0,198,111,0.4)]"
            >
              View pricing
            </Link>
            <Link
              href="/controller"
              className="px-5 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition"
            >
              Controller OS →
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-5 space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Reference hardware</div>
          <Image
            src="/neo3.png"
            alt="NanoPi Neo3 board"
            width={420}
            height={260}
            className="rounded-lg w-full"
          />
          <div className="font-mono text-xs space-y-1 text-zinc-500">
            <div className="flex justify-between">
              <span>Model</span><span className="text-zinc-300">NanoPi Neo3</span>
            </div>
            <div className="flex justify-between">
              <span>SoC</span><span className="text-zinc-300">RK3328 · ARM64</span>
            </div>
            <div className="flex justify-between">
              <span>RAM</span><span className="text-zinc-300">2 GB LPDDR4</span>
            </div>
            <div className="flex justify-between">
              <span>Storage</span><span className="text-zinc-300">MicroSD / eMMC</span>
            </div>
            <div className="flex justify-between">
              <span>Interface</span><span className="text-zinc-300">USB 3.0 · GbE</span>
            </div>
            <div className="flex justify-between">
              <span>Price</span><span className="text-zinc-300">~€30</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">How it works</div>
          <h2 className="text-xl font-semibold tracking-tight">Three responsibilities, one device</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Read the UPS",
              body: "Connects via USB HID, SNMP v1/v2c/v3, or vendor network cards. Built on NUT — the open standard that supports hundreds of models from APC, Eaton, CyberPower, Riello, and more. No proprietary drivers.",
              tags: ["USB HID", "SNMP v1/v2c/v3", "NUT driver"],
            },
            {
              n: "02",
              title: "Act locally",
              body: "Power events are evaluated by the local rule engine. If the Controller is unreachable, the Connector still executes its shutdown rules independently. OB debounce (3 consecutive polls) and immediate LB response.",
              tags: ["Offline execution", "OB debounce", "No SPOF"],
            },
            {
              n: "03",
              title: "Sync to Controller",
              body: "When the Controller is online, the Connector streams metrics and events continuously. Status, battery %, load %, runtime, and extended NUT variables are forwarded every heartbeat interval.",
              tags: ["WebSocket", "30 s heartbeat", "Buffered sync"],
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

      {/* Capabilities + Compatibility */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Capabilities</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            {[
              "USB, SNMP v1/v2c/v3 and network card support",
              "Local rule execution — no controller needed",
              "Signed OTA updates pushed from Controller OS",
              "Secure adoption token — zero-touch onboarding",
              "Anti-cloning check — one token, one connector",
              "X25519 + AES-256-GCM encrypted tunnel to Controller",
              "TLS certificate pinning (TOFU) on first connect",
              "Persistent local event log (survives reboots)",
              "In-memory log ring buffer forwarded to Controller",
              "Hardware fingerprint (MAC + machine-id + CPU serial)",
            ].map(f => (
              <li key={f} className="flex gap-2">
                <span className="text-[#00C66F] shrink-0">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">UPS Compatibility</h2>
          <p className="text-xs text-zinc-500">Any UPS with a NUT driver works. Common vendors:</p>
          <div className="space-y-2">
            {[
              { vendor: "APC",         method: "USB HID · SNMP · NMC",     status: "Tested" },
              { vendor: "Eaton",       method: "USB HID · SNMP · NMC",     status: "Tested" },
              { vendor: "CyberPower",  method: "USB HID · SNMP",           status: "Tested" },
              { vendor: "Tripp Lite",  method: "USB HID",                  status: "Tested" },
              { vendor: "Vertiv",      method: "SNMP · NMC",               status: "Tested" },
              { vendor: "Generic HID", method: "USB HID (RFC 1628)",       status: "Should work" },
              { vendor: "Other",       method: "Any NUT driver",           status: "Community" },
            ].map(r => (
              <div key={r.vendor} className="flex items-center justify-between font-mono text-xs border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-300 w-28">{r.vendor}</span>
                <span className="text-zinc-500 flex-1">{r.method}</span>
                <span className={r.status === "Tested" ? "text-[#00C66F]" : "text-zinc-600"}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deployment scenarios */}
      <section className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Deployment scenarios</div>
        <div className="grid gap-3 md:grid-cols-3 text-xs">
          {[
            {
              label: "Homelab",
              desc: "1 Connector next to 1 UPS, 1 Controller on the same LAN. Total hardware cost: ~€60.",
            },
            {
              label: "Server room",
              desc: "3–4 Connectors per rack row, single Controller, multi-UPS dashboard. One management VLAN.",
            },
            {
              label: "Multi-site",
              desc: "Connectors at remote sites relay through cloud proxy. One Controller view across all locations.",
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
          <div className="text-sm font-semibold text-white">Ready to deploy your first connector?</div>
          <div className="text-xs text-zinc-400">Pick a plan, flash the image, and adopt it from Controller OS in minutes.</div>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            href="/pricing"
            className="px-5 py-2.5 rounded-lg bg-[#00C66F] text-black text-sm font-semibold hover:bg-[#00b564] transition shadow-[0_0_24px_rgba(0,198,111,0.35)]"
          >
            View pricing
          </Link>
          <Link
            href="/controller"
            className="px-5 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            Controller OS →
          </Link>
        </div>
      </section>

    </div>
  );
}
