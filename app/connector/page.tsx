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
            className="w-[380px] md:w-[420px] lg:w-[480px] rounded-xl shadow-2xl"
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
    Compact footprint — easy to mount next to any UPS
  </li>
  <li className="flex gap-2">
    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
    Boots from microSD — simple to flash, reliable for 24/7 use
  </li>
</ul>

<div className="space-y-1 text-sm text-zinc-400">
  <div className="font-semibold text-white">Technical specs</div>
  <ul className="space-y-1">
    <li>• Rockchip RK3328 quad-core up to 1.5 GHz</li>
    <li>• 2 GB RAM (more than enough for Connector OS)</li>
    <li>• microSD storage for the OS image</li>
    <li>• 1× USB 3.0 port for direct USB-connected UPS devices</li>
    <li>• 1× Gigabit Ethernet interface</li>
    <li>• Low power consumption, suitable for 24/7 edge deployments</li>
  </ul>
</div>

          <div className="pt-2">
            <a
  href="/buy-connector"
  className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition"
>
  Buy Connector node (NanoPi Neo3)
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
