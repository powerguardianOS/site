import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connector OS',
  description: 'The edge agent next to your UPS — offline-first, vendor-agnostic, NanoPi Neo3.',
}

export default function ConnectorPage() {
  return (
    <div className="max-w-5xl mx-auto px-6">

      {/* HERO */}
      <section className="py-28 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#00C66F]/60">Connector OS</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] text-white">
            The edge agent<br />next to your UPS.
          </h1>
          <p className="text-base text-zinc-400 leading-relaxed">
            Connector OS runs on a NanoPi Neo3 placed next to each UPS. It handles all low-level communication — USB HID, SNMP, network cards — and executes shutdown rules locally, even without network access.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/pricing"
              className="px-6 py-3 rounded-lg bg-[#00C66F] text-black font-semibold hover:bg-[#00b564] transition-all"
            >
              View pricing
            </Link>
            <Link
              href="/controller"
              className="px-6 py-3 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
            >
              Controller OS →
            </Link>
          </div>
        </div>

        {/* Specs card */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 font-mono text-sm space-y-2.5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#00C66F]/60 mb-4">Reference hardware</div>
          {[
            ['Model',     'NanoPi Neo3'],
            ['SoC',       'RK3328 · ARM64'],
            ['RAM',       '2 GB LPDDR4'],
            ['Storage',   'MicroSD / eMMC'],
            ['Interface', 'USB 3.0 · GbE'],
            ['Price',     '~€30'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
              <span className="text-zinc-500">{k}</span>
              <span className="text-zinc-200">{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="py-24 space-y-12">
        <div className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Capabilities</div>
          <h2 className="text-3xl font-bold text-white tracking-tight">What Connector OS does</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 space-y-3 hover:border-zinc-700 transition-colors">
            <h3 className="text-base font-semibold text-white">Core capabilities</h3>
            <ul className="space-y-2.5 text-sm text-zinc-400">
              {[
                'USB HID, SNMP v1/v2c/v3 and network card support',
                'Local rule execution — no controller needed',
                'OB debounce (3 polls) + immediate LB response',
                'X25519 + AES-256-GCM encrypted tunnel',
                'TLS certificate pinning (TOFU on first connect)',
                'Signed OTA updates pushed from Controller',
                'Zero-touch adoption with one-time token',
                'Hardware fingerprint anti-cloning check',
                'In-memory log buffer forwarded to Controller',
              ].map(f => (
                <li key={f} className="flex gap-2.5">
                  <span className="text-[#00C66F] shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 space-y-3 hover:border-zinc-700 transition-colors">
            <h3 className="text-base font-semibold text-white">UPS compatibility</h3>
            <div className="font-mono text-xs space-y-0">
              <div className="flex gap-3 text-zinc-600 pb-2 border-b border-white/[0.05]">
                <span className="w-28">Vendor</span>
                <span className="flex-1">Protocol</span>
                <span>Status</span>
              </div>
              {[
                ['APC',         'USB HID · SNMP · NMC', 'Tested'],
                ['Eaton',       'USB HID · SNMP · NMC', 'Tested'],
                ['CyberPower',  'USB HID · SNMP',       'Tested'],
                ['Tripp Lite',  'USB HID',              'Tested'],
                ['Vertiv',      'SNMP · NMC',           'Tested'],
                ['Generic HID', 'USB HID (RFC 1628)',   'Should work'],
              ].map(([v, p, s]) => (
                <div key={v} className="flex gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <span className="w-28 text-zinc-300">{v}</span>
                  <span className="flex-1 text-zinc-500">{p}</span>
                  <span className={s === 'Tested' ? 'text-[#00C66F]' : 'text-zinc-600'}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Ready to deploy your first connector?</h2>
            <p className="text-sm text-zinc-400">Flash the image, plug it in, adopt from Controller OS in minutes.</p>
          </div>
          <div className="flex flex-wrap gap-4 shrink-0">
            <Link href="/pricing" className="px-6 py-3 rounded-lg bg-[#00C66F] text-black font-semibold hover:bg-[#00b564] transition-all">
              View pricing
            </Link>
            <Link href="/docs" className="px-6 py-3 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all">
              Documentation →
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
