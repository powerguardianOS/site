export default function ConnectorPage() {
  return (
    <div className="space-y-14">
      {/* HERO */}
      <section className="space-y-6">
        <div className="pg-pill">Connector OS · Edge UPS Agent</div>

        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Connector OS for the{" "}
          <span className="text-[#00C66F]">NanoPi Neo3</span>
        </h1>

        <p className="text-zinc-400 text-lg max-w-2xl">
          Connector OS runs directly on the NanoPi Neo3 — a small, efficient and
          ultra-reliable edge device that sits right next to your UPS.  
          It's the primary reference platform for PowerGuardian deployments.
        </p>
      </section>

      {/* DEVICE BLOCK */}
      <section className="pg-card p-6 md:p-8 grid md:grid-cols-2 gap-10 items-center">
        {/* DEVICE IMAGE */}
        <div className="flex justify-center">
          <img
            src="/neo3.png"
            alt="NanoPi Neo3"
            className="rounded-xl border border-zinc-800 w-full max-w-xs"
          />
        </div>

        {/* DEVICE DETAILS */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold">NanoPi Neo3</h2>
            <p className="text-zinc-400 text-sm">
              Primary reference platform for Connector OS deployments.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
              Gigabit Ethernet — ideal for UPS monitoring & fast sync
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
              Small footprint — fits behind or on top of any UPS
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
              Boots from SD or eMMC — reliable for 24/7 setups
            </li>
          </ul>

          <div className="space-y-1 text-sm text-zinc-400">
            <div className="font-semibold text-white">Technical specs</div>
            <ul className="space-y-1">
              <li>• RK3328 Quad-core 1.5 GHz</li>
              <li>• 1 GB RAM (sufficient for Connector OS)</li>
              <li>• USB 3.0 for UPS direct-USB</li>
              <li>• Gigabit Ethernet w/ stable link negotiation</li>
              <li>• Low power consumption (~2–3W)</li>
              <li>• Operates headless, ideal for rack UPS nodes</li>
            </ul>
          </div>

          <div className="pt-2">
            <a
              href="/downloads"
              className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition"
            >
              Download Connector OS image
            </a>
          </div>
        </div>
      </section>

      {/* FOOTNOTE */}
      <section className="text-xs text-zinc-500">
        Support for additional hardware platforms will be added over time.
        Connector OS is portable across ARM and x86 as long as the device runs a
        supported Linux build and NUT-compatible interfaces.
      </section>
    </div>
  );
}
