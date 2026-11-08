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
              Self-hosted UPS orchestration
            </span>
          </div>
          <h1 className="pg-display text-[3.5rem] md:text-[4.75rem] text-white">
            Power protection,<br />
            <em className="text-zinc-400">under your control.</em>
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed max-w-md">
            PowerGuardian is the UPS server for your servers, NAS and hypervisors. They listen to it like they would to a UPS network card. A device that can&apos;t listen is shut down over SSH or switched off at its PDU outlet, and powered back on when the mains return.
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
              <span className="ml-3 font-mono text-[11px] text-zinc-600">https://powerguardian.local</span>
            </div>
            <Image src="/product-dashboard-v4.webp" alt="PowerGuardian overview with demo data: four UPSes, one on battery, and what needs attention" width={2000} height={1250} priority className="w-full h-auto" />
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
        <span className="text-[11px] font-mono text-zinc-700 shrink-0">via NUT · SNMP</span>
      </div>

      {/* FEATURES — bento grid */}
      <section className="py-24 space-y-12">
        <div className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">What it does</div>
          <h2 className="pg-display text-4xl md:text-5xl text-white">One box that keeps every device <em className="text-zinc-400">Guarded.</em></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              title: 'PowerGuardian is the UPS server',
              body: 'Servers, NAS and hypervisors listen to PowerGuardian over NUT or SNMP, the same way they would listen to a UPS network card. No password of the device is needed.',
              tags: ['NUT', 'SNMP', 'No device password'],
            },
            {
              title: 'A fallback for every device',
              body: 'A device that can\'t listen is shut down over SSH, or its APC PDU outlet is switched off. When the power is back, it comes back on with Wake-on-LAN or outlet on.',
              tags: ['SSH', 'APC PDU', 'Wake-on-LAN'],
            },
            {
              title: 'The controller already knows',
              body: 'A problem shows up with the real device name, the concrete cause and the action that fixes it. No error codes to look up.',
              tags: ['Device name', 'Cause', 'Fix'],
            },
            {
              title: 'Acts without the controller',
              body: 'Each Connector keeps its own shutdown rules. If the Controller can\'t be reached, the Connector acts on its own. No cloud on the critical path.',
              tags: ['Offline-first', 'Local rules', 'No SPOF'],
            },
            {
              title: 'Encrypted credential vault',
              body: 'SSH keys, SNMP communities and API tokens live in an AES-256-GCM vault, never in plain text. Sign-in is protected with TOTP MFA.',
              tags: ['AES-256-GCM', 'TOTP MFA'],
            },
            {
              title: 'Your hardware, every site',
              body: 'Controller and Connectors run on your own hardware. Move the Controller to a new box with a migration. Manage several sites and their licences from PG Cloud.',
              tags: ['Self-hosted', 'Migration', 'PG Cloud'],
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
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Guarded devices</div>
            <h2 className="pg-display text-3xl md:text-4xl text-white">Every device, <em className="text-zinc-400">and how it goes down.</em></h2>
            <p className="text-base text-zinc-400 leading-relaxed max-w-md">
              One list of everything on UPS power: which UPS feeds it, how it shuts down (listening to PowerGuardian, SSH or a PDU outlet), its place in the shutdown order and how it comes back on. The controller always goes last.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm text-zinc-500">
              {['Shutdown order', 'Power back on', 'Controller last'].map(t => (
                <span key={t} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#00C66F]" />{t}</span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute -inset-8 -z-10" style={{ background: 'radial-gradient(closest-side, rgba(0,198,111,0.10), transparent 70%)' }} />
            <div className="rounded-xl border border-white/[0.08] overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
              <Image src="/product-devices-v4.webp" alt="Guarded devices list with demo data: NAS, hypervisor, servers and a switch with their shutdown order" width={2000} height={1250} className="w-full h-auto" />
            </div>
          </div>
        </div>

        {/* Row 2 — image left, text right */}
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div className="relative lg:order-1 order-2">
            <div className="pointer-events-none absolute -inset-8 -z-10" style={{ background: 'radial-gradient(closest-side, rgba(0,198,111,0.10), transparent 70%)' }} />
            <div className="rounded-xl border border-white/[0.08] overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
              <Image src="/product-ups-v4.webp" alt="UPS detail with demo data: battery, load, runtime and the devices this UPS powers" width={2000} height={1250} className="w-full h-auto" />
            </div>
          </div>
          <div className="space-y-5 lg:order-2 order-1">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00C66F]/60">Per-UPS detail</div>
            <h2 className="pg-display text-3xl md:text-4xl text-white">Open <em className="text-zinc-400">any UPS.</em></h2>
            <p className="text-base text-zinc-400 leading-relaxed max-w-md">
              Battery, load and runtime with their history, the last self-test, and exactly which devices this UPS powers, in the order they shut down. No guesswork when the power drops.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm text-zinc-500">
              {['Battery history', 'Self-tests', 'What it powers'].map(t => (
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
            Two components.<br /><em className="text-zinc-400">All on your hardware.</em>
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed">
            The <strong className="text-zinc-200">Controller</strong> is the UPS server your devices listen to. It keeps the shutdown order, runs the dashboard and can have its own UPS on USB. A <strong className="text-zinc-200">Connector</strong> sits next to another UPS, reads it over USB or SNMP and acts on its own when the Controller is out of reach.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/connector" className="text-[#00C66F] hover:text-[#1af189] transition-colors">Connector OS →</Link>
            <Link href="/controller" className="text-zinc-400 hover:text-white transition-colors">Controller OS →</Link>
          </div>
        </div>

        <div className="space-y-1 font-mono text-sm">
          {[
            { label: 'Controller OS', sub: 'UPS server · dashboard · vault', badge: 'NanoPi R3S · x86', active: true },
            'WebSocket',
            { label: 'Connector OS', sub: 'NUT · USB/SNMP · acts offline', badge: 'NanoPi Neo3 · x86', active: false },
            'USB · SNMP',
            { label: 'UPS Device', sub: 'APC · Eaton · CyberPower · Generic HID', badge: 'Hardware', active: false },
          ].map((row, i) => typeof row === 'string' ? (
            <div key={i} className="flex items-center gap-3 py-1 px-3">
              <div className="w-px h-7 bg-gradient-to-b from-[#00C66F]/40 to-transparent mx-auto ml-4" />
              <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">{row}</span>
            </div>
          ) : (
            <div key={row.label} className={`flex items-center justify-between gap-3 rounded-xl px-5 py-4 border ${
              row.active
                ? 'border-[#00C66F]/25 bg-gradient-to-r from-[#00C66F]/[0.06] to-transparent'
                : 'border-white/[0.06] bg-[#0d1321]/60'
            }`}>
              <div>
                <div className={`font-semibold text-sm ${row.active ? 'text-[#00C66F]' : 'text-zinc-200'}`}>{row.label}</div>
                <div className="text-zinc-600 text-xs mt-0.5">{row.sub}</div>
              </div>
              <span className="shrink-0 whitespace-nowrap text-[10px] border border-white/10 rounded-lg px-2.5 py-1 text-zinc-500">{row.badge}</span>
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
              Keep every device <em className="text-[#00C66F]">Guarded.</em>
            </h2>
            <p className="text-lg text-zinc-400">
              Self-hosted. Runs on your own hardware. No cloud on the critical path.
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
