export default function ControllerPage() {
  return (
    <div className="space-y-16">
      {/* HERO */}
      <section className="grid gap-10 md:grid-cols-[3fr,2fr] items-start">
        {/* Left side: intro */}
        <div className="space-y-6">
          <div className="pg-pill">Controller OS · orchestration layer</div>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Controller OS
            <span className="block text-[#00C66F]">
              The brain of your power infrastructure.
            </span>
          </h1>

          <p className="text-zinc-400 text-lg max-w-2xl">
            PowerGuardian Controller OS provides a unified, self-hosted control
            plane for UPS environments across brands, sites and network
            segments. Zero-touch adoption, a flexible rule engine,
            VLAN-aware networking and secure OTA updates — all managed from one
            clean dashboard.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="/downloads"
              className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[0_0_30px_rgba(0,198,111,0.35)]"
            >
              Download Controller OS
            </a>
            <a
              href="/connector"
              className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
            >
              Explore Connector OS
            </a>
          </div>
        </div>

        {/* Right side: quick architecture snapshot */}
        <div className="pg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            ARCHITECTURE SNAPSHOT
          </h2>

          <div className="space-y-3 text-sm text-zinc-300">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">Controller OS</span>
                <span className="rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                  NanoPi R3S / VM / Docker
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Central dashboard, rule engine, credential vault, VLAN-aware
                networking and OTA control.
              </p>
            </div>

            <div className="flex items-center justify-center">
              <div className="h-px w-12 bg-zinc-700" />
              <span className="mx-2 text-[10px] tracking-[0.2em] uppercase text-zinc-500">
                Encrypted sync
              </span>
              <div className="h-px w-12 bg-zinc-700" />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">Connector OS</span>
                <span className="rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                  NanoPi Neo3 / Pi
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Local UPS daemon, NUT-based, buffered events, local failover
                rules and OTA client.
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
            Controller OS orchestrates Connectors and UPS devices across sites.
            One control plane for discovery, rules, shutdown sequencing and
            updates.
          </p>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="pg-card p-6 space-y-3">
          <h2 className="pg-section-title">Core capabilities</h2>
          <p className="text-sm text-zinc-300">
            Controller OS is designed to be your central power orchestration layer:
          </p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Unified control plane for multi-vendor UPS environments</li>
            <li>• Zero-touch discovery and adoption of Connector OS nodes</li>
            <li>• Central rule engine for shutdown sequencing and policies</li>
            <li>• Global view of runtime, battery health and alerts</li>
          </ul>
        </div>

        <div className="pg-card p-6 space-y-3">
          <h2 className="pg-section-title">Rule engine</h2>
          <p className="text-sm text-zinc-300">
            Define exactly how your infrastructure reacts during power events:
          </p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Multi-host shutdown ordering and delays</li>
            <li>• Cluster-aware logic for hypervisors, NAS and switches</li>
            <li>• Battery-level and runtime thresholds for emergency modes</li>
            <li>• UPS-to-host mapping per rack, per room or per site</li>
          </ul>
        </div>
      </section>

      {/* VLAN & NETWORK DESIGN */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="pg-section-title">VLAN &amp; network design</h2>

        <p className="text-sm text-zinc-300 max-w-3xl">
          Love clean network segmentation? PowerGuardian has you covered. In a
          default setup, <span className="font-medium text-white">LAN1</span>{" "}
          behaves like a normal interface on your main network. As long as
          Controller OS lives in the same segment, it can automatically
          discover Connectors and UPS management cards{" "}
          <span className="text-zinc-400">(manual add is always possible)</span>.
        </p>

        <ul className="space-y-2 text-sm text-zinc-400 mt-3">
          <li>
            • <span className="font-medium text-white">Simple mode:</span>{" "}
            LAN1 on your primary LAN, discovering Connectors and UPS
            management cards in the same subnet.
          </li>
          <li>
            • <span className="font-medium text-white">VLAN-aware mode:</span>{" "}
            Controller OS understands tagged and untagged traffic, so you can
            present multiple VLANs on a single switch port and still keep power
            management neatly segmented.
          </li>
          <li>
            • <span className="font-medium text-white">Dual-NIC isolation:</span>{" "}
            prefer to keep UPS and IoT traffic fully separate? Use LAN1 for your
            regular LAN and LAN2 for a dedicated management or IoT network.
          </li>
        </ul>

        <p className="text-xs text-zinc-500 mt-3 max-w-2xl">
          The idea is simple: keep your power-control layer reachable and stable,
          even when the rest of the network is noisy, under maintenance, or being
          reconfigured.
        </p>
      </section>

      {/* CREDENTIAL VAULT + SECURITY */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="pg-card p-6 space-y-3">
          <h2 className="pg-section-title">Credential vault</h2>
          <p className="text-sm text-zinc-300">
            All authentication data is stored in an encrypted vault inside
            Controller OS:
          </p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• SNMP communities for UPS and PDU devices</li>
            <li>• SSH users for hypervisors, NAS and servers</li>
            <li>• API tokens and integration secrets</li>
            <li>• No plain-text configs, no scattered secrets</li>
          </ul>
        </div>

        <div className="pg-card p-6 space-y-3">
          <h2 className="pg-section-title">Security model</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Encrypted controller–connector communication</li>
            <li>• Hardware-bound identity per Connector node</li>
            <li>• Anti-cloning protections and node tokens</li>
            <li>• Root login disabled by default</li>
            <li>• Optional MFA for Controller UI access</li>
            <li>• Signed update packages for firmware &amp; OS</li>
          </ul>
        </div>
      </section>

      {/* CTA / NEXT STEPS */}
      <section className="pg-card p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Ready to centralize your power orchestration?
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl">
            Start with a single Controller OS instance and a couple of
            Connectors. Grow into racks, sites or full datacenters without
            changing your architecture — the control plane stays the same.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/downloads"
            className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition"
          >
            Get Controller OS image
          </a>
          <a
            href="/connector"
            className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
          >
            View Connector OS details
          </a>
        </div>
      </section>
    </div>
  );
}
