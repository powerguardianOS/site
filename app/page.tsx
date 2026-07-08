import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">

      {/* Ambient hero glow — full-bleed, behind everything */}
      <div className="pg-ambient pg-ambient-hero" style={{ height: 820 }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6">

      {/* HERO */}
      <section className="py-28 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#00C66F] shadow-[0_0_6px_rgba(0,198,111,0.8)]" />
            <span className="text-[11px] font-mono uppercase tracking-[0.26em] text-zinc-500">
              UPS Orchestration Platform
            </span>
          </div>
          <h1 className="pg-display text-[3.5rem] md:text-[4.75rem] text-white">
            Power protection,<br />
            <em className="text-zinc-400">under your control.</em>
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed max-w-md">
            Replace scattered NUT configs and manual shutdown scripts with a single self-hosted control plane. Built for homelabs and server rooms that can&apos;t afford unplanned downtime.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/pricing"
              className="pg-btn-primary px-7 py-3.5 rounded-lg font-semibold"
            >
              View pricing
            </Link>
            <Link
              href="/docs"
              className="px-7 py-3.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 hover:border-zinc-700 transition-all"
            >
              Documentation →
            </Link>
          </div>
        </div>

        {/* Real product screenshot — framed as an app window */}
        <div className="relative lg:-mr-8 xl:-mr-16">
          <div className="pointer-events-none absolute -inset-10 -z-10"
            style={{ background: "radial-gradient(closest-side, rgba(0,198,111,0.12), transparent 70%)" }} />
          <div className="rounded-xl border border-white/[0.08] bg-[#0b0f18] overflow-hidden shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85),0_0_0_1px_rgba(0,198,111,0.05)]">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] bg-[#080c14]">
              <span className="w-2.5 h-2.5 rounded-full bg-white/[0.09]" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/[0.09]" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/[0.09]" />
              <span className="ml-3 font-mono text-[11px] text-zinc-600">app.powerguardian.cloud</span>
            </div>
            <Image src="/product-overview.png" alt="PowerGuardian control-plane dashboard" width={1440} height={900} priority className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="border-y border-white/[0.05] py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-700 shrink-0">Works with</span>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {['APC', 'Eaton', 'CyberPower', 'Tripp Lite', 'Vertiv', 'Generic HID'].map(b => (
            <span key={b} className="text-sm font-medium text-zinc-500">{b}</span>
          ))}
        </div>
        <span className="text-[11px] font-mono text-zinc-700 shrink-0">via NUT · SNMP RFC 1628</span>
      </div>

      {/* FEATURES — bento grid */}
      <section className="py-24 space-y-12">
        <div className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Core capabilities</div>
          <h2 className="pg-display text-4xl md:text-5xl text-white">Everything the manual never covered</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              title: 'Offline-first rule engine',
              body: 'Shutdown rules execute locally on each Connector. If the Controller is unreachable the Connector acts independently — no cloud on the critical path.',
              tags: ['Local execution', 'No SPOF', 'OB debounce'],
            },
            {
              title: 'Encrypted credential vault',
              body: 'SNMP strings, SSH keys, and API tokens stored in an AES-256-GCM vault. Never in plaintext. Unlock with TOTP MFA.',
              tags: ['AES-256-GCM', 'TOTP MFA', 'TOFU'],
            },
            {
              title: 'Multi-vendor UPS support',
              body: 'Built on NUT. Any UPS with a NUT driver works — USB HID, SNMP v1/v2c/v3, vendor network cards. No recompilation needed.',
              tags: ['USB HID', 'SNMP v1/v2c/v3', 'NMC'],
            },
          ].map(f => (
            <div key={f.title} className="pg-feature p-6 space-y-4">
              <h3 className="text-base font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.body}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {f.tags.map(t => (
                  <span key={t} className="text-[10px] font-mono border border-[#00C66F]/20 text-[#00C66F]/70 px-2 py-0.5 rounded-md bg-[#00C66F]/[0.04]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCT SHOWCASE — real screenshots */}
      <section className="py-24 space-y-24">
        {/* Row 1 — text left, image right */}
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div className="space-y-5">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Fleet visibility</div>
            <h2 className="pg-display text-3xl md:text-4xl text-white">Every UPS, <em className="text-zinc-400">one dense view.</em></h2>
            <p className="text-base text-zinc-400 leading-relaxed max-w-md">
              Battery, load, runtime and status across every site in a single control plane. Sort, scan, and drill in — the same data your connectors report over the wire, live.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm text-zinc-500">
              {['Multi-site rollup', 'Live status', 'Tabular metrics'].map(t => (
                <span key={t} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#00C66F]" />{t}</span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute -inset-8 -z-10" style={{ background: 'radial-gradient(closest-side, rgba(0,198,111,0.10), transparent 70%)' }} />
            <div className="rounded-xl border border-white/[0.08] overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
              <Image src="/product-devices.png" alt="PowerGuardian devices table" width={1440} height={900} className="w-full h-auto" />
            </div>
          </div>
        </div>

        {/* Row 2 — image left, text right */}
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div className="relative lg:order-1 order-2">
            <div className="pointer-events-none absolute -inset-8 -z-10" style={{ background: 'radial-gradient(closest-side, rgba(0,198,111,0.10), transparent 70%)' }} />
            <div className="rounded-xl border border-white/[0.08] overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
              <Image src="/product-detail.png" alt="PowerGuardian device detail" width={1440} height={900} className="w-full h-auto" />
            </div>
          </div>
          <div className="space-y-5 lg:order-2 order-1">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Per-device depth</div>
            <h2 className="pg-display text-3xl md:text-4xl text-white">Drill into <em className="text-zinc-400">any device.</em></h2>
            <p className="text-base text-zinc-400 leading-relaxed max-w-md">
              Charge and load history, live metrics, an event timeline, and the exact ordered shutdown sequence that will run when the battery gives out. No guesswork when the power drops.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm text-zinc-500">
              {['Time-series charts', 'Event log', 'Shutdown sequence'].map(t => (
                <span key={t} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#00C66F]" />{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section className="py-24 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Architecture</div>
          <h2 className="pg-display text-4xl md:text-5xl text-white">
            Two components.<br /><em className="text-zinc-400">One control plane.</em>
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed">
            A <strong className="text-zinc-200">Connector</strong> sits next to each UPS and handles low-level communication — USB, SNMP, NMC. A <strong className="text-zinc-200">Controller</strong> aggregates all connectors, runs the rule engine, and exposes the dashboard. Both run on your hardware.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/connector" className="text-[#00C66F] hover:text-[#1af189] transition-colors">Connector OS →</Link>
            <Link href="/controller" className="text-zinc-400 hover:text-white transition-colors">Controller OS →</Link>
          </div>
        </div>

        <div className="space-y-1 font-mono text-sm">
          {[
            { label: 'Controller OS', sub: 'Dashboard · rule engine · vault', badge: 'NanoPi R3S', active: true },
            null,
            { label: 'Connector OS', sub: 'NUT agent · USB/SNMP · local rules', badge: 'NanoPi Neo3', active: false },
            null,
            { label: 'UPS Device', sub: 'APC · Eaton · CyberPower · Generic HID', badge: 'Hardware', active: false },
          ].map((row, i) => row === null ? (
            <div key={i} className="flex items-center gap-3 py-1 px-3">
              <div className="w-px h-7 bg-gradient-to-b from-[#00C66F]/40 to-transparent mx-auto ml-4" />
              <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">WebSocket</span>
            </div>
          ) : (
            <div key={row.label} className={`flex items-center justify-between rounded-xl px-5 py-4 border ${
              row.active
                ? 'border-[#00C66F]/25 bg-gradient-to-r from-[#00C66F]/[0.06] to-transparent'
                : 'border-white/[0.06] bg-[#0d1321]/60'
            }`}>
              <div>
                <div className={`font-semibold text-sm ${row.active ? 'text-[#00C66F]' : 'text-zinc-200'}`}>{row.label}</div>
                <div className="text-zinc-600 text-xs mt-0.5">{row.sub}</div>
              </div>
              <span className="text-[10px] border border-white/10 rounded-lg px-2.5 py-1 text-zinc-500">{row.badge}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-28">
        <div className="relative overflow-hidden rounded-3xl border border-[#00C66F]/15 bg-gradient-to-b from-[#0b1120] to-[#070b14] px-6 py-20 text-center">
          <div className="pg-ambient pg-ambient-cta" />
          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <h2 className="pg-display text-5xl md:text-6xl text-white">
              Ready to take control of your <em className="text-[#00C66F]">power layer?</em>
            </h2>
            <p className="text-lg text-zinc-400">
              Self-hosted. No per-device fees. Runs on €30 hardware.
            </p>
            <Link
              href="/pricing"
              className="pg-btn-primary inline-block px-9 py-4 rounded-lg font-semibold"
            >
              View pricing →
            </Link>
          </div>
        </div>
      </section>

      </div>
    </div>
  )
}
