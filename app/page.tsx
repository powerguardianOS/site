import Link from 'next/link'

function StatusRow({
  name, status, battery,
}: {
  name: string
  status: 'OL' | 'OB' | 'OB LB'
  battery: number
}) {
  const ok   = status === 'OL'
  const warn = status === 'OB'
  return (
    <div className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
      ok   ? 'bg-[#00C66F]/[0.04] border-[#00C66F]/20'
      : warn ? 'bg-amber-950/30 border-amber-900/30'
      : 'bg-red-950/30 border-red-900/30'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${
          ok   ? 'bg-[#00C66F] animate-pulse shadow-[0_0_8px_rgba(0,198,111,0.8)]'
          : warn ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
          : 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse'
        }`} />
        <span className={`text-sm ${ok ? 'text-zinc-200' : warn ? 'text-amber-200' : 'text-red-200'}`}>{name}</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-xs">
        <span className={`px-2 py-0.5 rounded-md border ${
          ok   ? 'border-[#00C66F]/25 text-[#00C66F]'
          : warn ? 'border-amber-800/50 text-amber-400'
          : 'border-red-800/50 text-red-400'
        }`}>{status}</span>
        <span className={ok ? 'text-zinc-500' : warn ? 'text-amber-400' : 'text-red-400'}>{battery}%</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-6">

      {/* HERO */}
      <section className="py-28 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <div className="text-[11px] font-mono uppercase tracking-[0.28em] text-[#00C66F]/65">
            UPS Orchestration Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-white">
            Power protection,<br />under your control.
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed max-w-md">
            Replace scattered NUT configs and manual shutdown scripts with a single self-hosted control plane. Built for homelabs and server rooms that can&apos;t afford unplanned downtime.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/pricing"
              className="px-7 py-3.5 rounded-lg bg-[#00C66F] text-black font-semibold hover:bg-[#00b564] transition-all"
            >
              View pricing
            </Link>
            <Link
              href="/docs"
              className="px-7 py-3.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
            >
              Documentation →
            </Link>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1321] overflow-hidden shadow-[0_0_60px_rgba(0,198,111,0.07)]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-[#090d1a]">
            <span className="font-mono text-xs text-zinc-500">PowerGuardian · Dashboard</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#00C66F]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C66F] animate-pulse" />
              3 online
            </span>
          </div>
          <div className="p-4 space-y-2">
            <StatusRow name="Main UPS"   status="OL"    battery={98} />
            <StatusRow name="Rack UPS"   status="OL"    battery={87} />
            <StatusRow name="Backup UPS" status="OB LB" battery={14} />
          </div>
          <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 mt-1 space-y-1.5">
            {[
              { t: '09:14', m: 'Backup UPS — battery critical, shutdown queued', c: 'text-red-400' },
              { t: '09:12', m: 'nas-01 — graceful shutdown via SSH',              c: 'text-amber-400' },
              { t: '09:10', m: 'rack-02 — connector adopted',                     c: 'text-zinc-600' },
            ].map(e => (
              <div key={e.t} className="flex gap-3 font-mono text-[10px]">
                <span className="text-zinc-700 shrink-0">{e.t}</span>
                <span className={e.c}>{e.m}</span>
              </div>
            ))}
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
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Everything the manual never covered</h2>
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
            <div
              key={f.title}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 hover:border-zinc-700 transition-colors"
            >
              <h3 className="text-base font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.body}</p>
              <div className="flex flex-wrap gap-1.5">
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

      {/* ARCHITECTURE */}
      <section className="py-24 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Architecture</div>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Two components.<br />One control plane.
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
      <section className="py-32 text-center space-y-6 max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
          Ready to take control of your power layer?
        </h2>
        <p className="text-lg text-zinc-400">
          Self-hosted. No per-device fees. Runs on €30 hardware.
        </p>
        <Link
          href="/pricing"
          className="inline-block px-9 py-4 rounded-lg bg-[#00C66F] text-black font-semibold hover:bg-[#00b564] transition-all"
        >
          View pricing →
        </Link>
      </section>

    </div>
  )
}
