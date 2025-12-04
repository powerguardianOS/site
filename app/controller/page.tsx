// app/controller/page.tsx
import Link from "next/link";

export default function ControllerPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Controller OS
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Controller OS · your power control plane.
        </h1>
        <p className="text-sm md:text-base text-zinc-400 max-w-2xl">
          Controller OS is where you adopt connectors, map UPS devices to
          hosts and racks, define shutdown rules and manage credentials and
          updates. Think of it as the central brain for your power layer.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/connector"
            className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
          >
            See how Connector OS fits in
          </Link>
          <Link
            href="/downloads"
            className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition"
          >
            Download images
          </Link>
        </div>
      </section>

      {/* Core capabilities */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Core features</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Zero-touch connector adoption with secure tokens</li>
            <li>• UPS discovery overview across all sites</li>
            <li>• Rule engine for staged shutdown sequences</li>
            <li>• Encrypted credential vault for SNMP, SSH and APIs</li>
            <li>• Google Drive backups and optional cloud proxy</li>
          </ul>
        </div>

       <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
  VLAN &amp; network design
</h3>
<p className="text-sm text-zinc-400">
  Love clean network segmentation? PowerGuardian has you covered. In the
  default setup, LAN1 behaves like a normal network interface on your LAN.
  As long as Controller OS lives in the same network segment, it can discover
  Connectors and UPS management cards automatically
  (manual add is still possible when needed).
</p>
<ul className="space-y-1 text-sm text-zinc-400 mt-3">
  <li>
    • <span className="font-medium">Simple mode:</span> LAN1 on your main LAN,
    discovering Connectors and UPS management cards in the same subnet.
  </li>
  <li>
    • <span className="font-medium">VLAN-aware mode:</span> Controller OS
    understands tagged and untagged traffic, so you can present multiple VLANs
    on a single port from your switch.
  </li>
  <li>
    • <span className="font-medium">Dual-NIC setups:</span> use LAN1 for your
    regular LAN and LAN2 for an isolated network, for example an IoT / UPS
    management segment.
  </li>
</ul>
<p className="text-xs text-zinc-500 mt-3">
  The idea is simple: keep your power-control layer reachable and cleanly
  segmented, even when the rest of the network is noisy, under maintenance
  or being reconfigured.
</p>
      </div>
      </section>

      {/* Rule engine & mapping */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Rules and shutdown mapping
        </h2>
        <p className="text-sm text-zinc-400 max-w-3xl">
          Instead of just mapping a UPS to an IP address, Controller OS lets you
          think in terms of racks, hosts and services. You can define which
          systems are sacrificial and which should survive as long as possible.
        </p>
        <div className="grid gap-4 md:grid-cols-3 text-sm text-zinc-400">
          <div>
            <h3 className="text-xs font-semibold text-zinc-200 mb-1">
              Homelab example
            </h3>
            <p className="text-xs text-zinc-500">
              Prioritize router and hypervisor, then gracefully power down your
              NAS and lab VMs.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200 mb-1">
              Small business rack
            </h3>
            <p className="text-xs text-zinc-500">
              Keep core services and primary storage alive longer than dev
              boxes or non-critical systems.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200 mb-1">
              Multi-UPS environments
            </h3>
            <p className="text-xs text-zinc-500">
              Assign different shutdown policies per UPS and per site, while
              viewing everything in one dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Security / access */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Security model</h2>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>• Encrypted credential vault</li>
            <li>• Role-based access: admin, operator, viewer</li>
            <li>• SSH access policy per role and per connector</li>
            <li>• Node tokens and anti-cloning checks for connectors</li>
          </ul>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            Where to run Controller OS
          </h3>
          <p className="text-sm text-zinc-400">
            You can run Controller OS on a NanoPi R3S, a dedicated x86 box or a
            VM / container. The idea is simple: treat it as a core piece of
            infrastructure for your power layer.
          </p>
          <p className="text-xs text-zinc-500">
            In many setups, running it on a small, low-power board or
            out-of-band VM is ideal—independent from your main hypervisor.
          </p>
        </div>
      </section>
    </div>
  );
}
