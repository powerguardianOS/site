import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Controller OS',
  description: 'The central control plane for your power layer — adopt connectors, run staged shutdowns, manage credentials.',
}

export default function ControllerPage() {
  return (
    <div className="max-w-5xl mx-auto px-6">

      {/* HERO */}
      <section className="py-28 max-w-3xl space-y-8">
        <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#00C66F]/60">Controller OS</div>
        <h1 className="pg-display text-5xl md:text-6xl text-white">
          The central control plane<br /><em className="text-zinc-400">for your power layer.</em>
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Controller OS runs on a NanoPi R3S and aggregates all your Connectors into a single dashboard. It runs the rule engine, manages credentials, and gives you visibility across every site — on your hardware, not ours.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/pricing"
            className="pg-btn-primary px-6 py-3 rounded-lg font-semibold"
          >
            View pricing
          </Link>
          <Link
            href="/connector"
            className="px-6 py-3 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
          >
            Connector OS →
          </Link>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="py-24 space-y-12">
        <div className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Capabilities</div>
          <h2 className="pg-display text-4xl md:text-5xl text-white">What Controller OS does</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent p-6 space-y-3 hover:border-zinc-700 transition-colors">
            <h3 className="text-base font-semibold text-white">Platform capabilities</h3>
            <ul className="space-y-2.5 text-sm text-zinc-400">
              {[
                'Zero-touch connector adoption with one-time tokens',
                'Multi-site dashboard — all UPS in one view',
                'Staged, ordered shutdown sequences',
                'Rule engine with confirmation window before trigger',
                'Automation flows: SSH, NUT INSTCMD, WoL, webhooks',
                'Signed OTA packages pushed to all connectors',
                'Role-based access: Owner / Admin / Viewer',
                'Dynamic DNS — 29 providers, background sync',
                'Google Drive backup scheduler',
                'VLAN-aware networking (802.1Q)',
                'Optional cloud proxy for remote access',
              ].map(f => (
                <li key={f} className="flex gap-2.5">
                  <span className="text-[#00C66F] shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent p-6 space-y-3 hover:border-zinc-700 transition-colors">
            <h3 className="text-base font-semibold text-white">Security model</h3>
            <ul className="space-y-2.5 text-sm text-zinc-400">
              {[
                'AES-256-GCM encrypted credential vault',
                'TOTP MFA for vault unlock and admin operations',
                'X25519 ECDH end-to-end payload encryption',
                'Connector tokens with hardware fingerprint binding',
                'SSH command whitelist — no free-form exec',
                'TOFU host key pinning for SSH shutdown targets',
                'SHA-256 verified OTA packages before install',
                '1 MB request body limit, CSP hardened frontend',
                'Login lockout per IP, persisted in database',
              ].map(f => (
                <li key={f} className="flex gap-2.5">
                  <span className="text-[#00C66F] shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="pg-display text-2xl md:text-3xl text-white">One control plane for your entire power layer.</h2>
            <p className="text-sm text-zinc-400">Pick a plan and manage UPS devices across every site.</p>
          </div>
          <div className="flex flex-wrap gap-4 shrink-0">
            <Link href="/pricing" className="pg-btn-primary px-6 py-3 rounded-lg font-semibold">
              View pricing
            </Link>
            <Link href="/connector" className="px-6 py-3 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all">
              Connector OS →
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
