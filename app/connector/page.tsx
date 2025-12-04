// app/connector/page.tsx
import Image from "next/image";
import Link from "next/link";

export default function ConnectorPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid gap-8 md:grid-cols-[3fr,2fr] items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Connector OS
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Connector OS · edge agent for your UPS.
          </h1>
          <p className="text-sm md:text-base text-zinc-400 max-w-xl">
            Connector OS runs next to your UPS and handles all low-level work:
            autodetecting devices via USB, SNMP or network cards, executing
            local shutdown rules and syncing events back to Controller OS.
          </p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Built on NUT (Network UPS Tools), but preconfigured</li>
            <li>• Local buffer &amp; rules if the controller is unavailable</li>
            <li>• OTA updates from Controller OS with signed packages</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/downloads"
              className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition"
            >
              Get Connector OS images
            </Link>
            <Link
              href="/controller"
              className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
            >
              See how Controller OS manages connectors
            </Link>
          </div>
        </div>

        {/* Neo3 visual */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-5">
          <div className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">
            Primary reference platform
          </div>
          <Image
            src="/neo3.png"
            alt="NanoPi Neo3 board"
            width={420}
            height={260}
            className="rounded-xl shadow-2xl"
          />
          <p className="text-xs text-zinc-500 text-center max-w-xs">
            NanoPi Neo3 running Connector OS next to a single UPS. Small,
            silent and built for 24/7 duty.
          </p>
        </div>
      </section>

      {/* Platform section */}
      <section className="grid gap-8 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">NanoPi Neo3</h2>
          <p className="text-sm text-zinc-400">
            The NanoPi Neo3 is the primary reference board for Connector OS
            deployments.
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>• RK3328 quad-core SoC</li>
            <li>• 2 GB RAM (more than enough for Connector OS)</li>
            <li>• Boots from microSD</li>
            <li>• USB 3.0 port for direct-USB UPS connectivity</li>
            <li>• Gigabit Ethernet for stable link and fast sync</li>
            <li>• Low power usage (a few watts), passively cooled</li>
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            Role in the architecture
          </h3>
          <p className="text-sm text-zinc-400">
            Connectors sit as close as possible to each UPS. They run all the
            NUT daemons, execute rules and keep a local view of power state.
            When Controller OS is reachable, they continuously sync events and
            metrics.
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>• One Connector can manage one or more UPS devices</li>
            <li>• Multiple Connectors feed into a single Controller</li>
            <li>• Safe shutdown even if network links go down</li>
          </ul>
        </div>
      </section>

      {/* Future hardware */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Other hardware platforms
        </h2>
        <p className="text-sm text-zinc-400 max-w-2xl">
          The initial focus is the NanoPi Neo3 as the primary edge platform. In
          future iterations, Connector OS aims to support more boards and small
          form-factor systems, as long as they are reliable, low-power and
          have stable storage.
        </p>
        <p className="text-xs text-zinc-500">
          Examples: Raspberry Pi variants, other NanoPi models and small x86
          thin clients.
        </p>
      </section>
    </div>
  );
}
