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
      <section className="py-32 max-w-3xl space-y-8">
        <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-zinc-500">Controller OS</div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] text-white">
          The central control plane<br />for your power layer.
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Controller OS runs on a NanoPi R3S and aggregates all your Connectors into a single dashboard. It runs the rule engine, manages credentials, and gives you visibility across every site — on your hardware, not ours.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/pricing"
            className="px-6 py-3 rounded-lg bg-[#00C66F] text-black font-semibold hover:bg-[#00b564] transition shadow-[0_0_32px_rgba(0,198,111,0.4)]"
          >
            View pricing
          </Link>
          <Link
            href="/connector"
            className="px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            Connector OS →
          </Link>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="py-24 space-y-12">
        <div className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">Capabilities</div>
          <h2 className="text-3xl font-bold text-white tracking-tight">What Controller OS does</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-zinc-800 bg-zinc-950/50 rounded-lg p-6 space-y-3">
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

          <div className="border border-zinc-800 bg-zinc-950/50 rounded-lg p-6 space-y-3">
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
        <div className="border border-zinc-800 rounded-lg p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">One control plane for your entire power layer.</h2>
            <p className="text-sm text-zinc-400">Pick a plan and manage UPS devices across every site.</p>
          </div>
          <div className="flex flex-wrap gap-4 shrink-0">
            <Link href="/pricing" className="px-6 py-3 rounded-lg bg-[#00C66F] text-black font-semibold hover:bg-[#00b564] transition shadow-[0_0_24px_rgba(0,198,111,0.35)]">
              View pricing
            </Link>
            <Link href="/connector" className="px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition">
              Connector OS →
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
