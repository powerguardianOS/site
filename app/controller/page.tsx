export default function ControllerPage() {
  return (
    <div className="space-y-10 md:space-y-14">
      {/* HERO */}
      <section className="grid gap-8 md:grid-cols-[3fr,2fr] items-start">
        <div className="space-y-5">
          <div className="pg-pill">Control plane · self-hosted</div>

          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Controller OS for{" "}
            <span className="text-[#00C66F]">multi-UPS environments.</span>
          </h1>

          <p className="text-zinc-400 text-base md:text-lg max-w-2xl">
            PowerGuardian Controller OS provides a unified, self-hosted control
            plane for UPS environments across brands, sites and network
            segments. Zero-touch adoption, a flexible rule engine, VLAN-aware
            networking and secure OTA updates — all managed from one clean dashboard.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="/downloads"
              className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[0_0_30px_rgba(0,198,111,0.4)]"
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

        {/* ARCHITECTURE SNAPSHOT */}
        <div className="pg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            Architecture snapshot
          </h2>

          <div className="space-y-4 text-sm text-zinc-300">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Controller OS
                </div>
                <p className="text-xs text-zinc-400">
                  Central dashboard, rule engine, credential vault, VLAN networking and OTA control.
                </p>
              </div>
              <span className="rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                NanoPi R3S / VM / Docker
              </span>
            </div>

            <div className="flex items-center justify-center">
              <div className="h-px w-10 bg-zinc-700" />
              <span className="mx-2 text-[10px] tracking-[0.2em] uppercase text-zinc-500">
                ENCRYPTED SYNC
              </span>
              <div className="h-px w-10 bg-zinc-700" />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Connector OS
                </div>
                <p className="text-xs text-zinc-400">
                  Local UPS daemon, NUT-based, buffered events, local failover rules and OTA client.
                </p>
              </div>
              <span className="rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                NanoPi Neo3 / Pi
              </span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 border-t border-zinc-800 pt-3">
            Controller OS orchestrates Connectors and UPS devices across sites.
            One control plane for discovery, rules, shutdown sequencing and updates.
          </p>
        </div>
      </section>

      {/* CAPABILITIES + RULE ENGINE */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="pg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            Core capabilities
          </h2>
          <p className="text-sm text-zinc-300">
            Controller OS is designed to be your central power orchestration layer.
          </p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Unified control plane for multi-vendor UPS environments</li>
            <li>• Zero-touch discovery and adoption of Connector OS nodes</li>
            <li>• Central rule engine for shutdown sequencing and policies</li>
            <li>• Global runtime and battery-health visibility</li>
            <li>• Backups, updates and config handled from one interface</li>
          </ul>
        </div>

        <div className="pg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            Rule engine
          </h2>
          <p className="text-sm text-zinc-300">
            Define exactly how your infrastructure reacts during power events.
          </p>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Multi-host shutdown ordering and delays</li>
            <li>• Cluster-aware logic for hypervisors, NAS and switches</li>
            <li>• Battery-level and runtime thresholds</li>
            <li>• UPS-to-host mapping per room, rack or site</li>
            <li>• Dry-run testing mode</li>
          </ul>
        </div>
      </section>

      {/* VLAN + SECURITY */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="pg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            VLAN &amp; network design
          </h2>

          <p className="text-sm text-zinc-300">
            Love network segmentation? PowerGuardian has you covered.
          </p>

          <p className="text-sm text-zinc-400">
            In a basic setup, LAN 1 behaves like a normal management interface.
            If the Controller is in the same network, it will discover Connectors
            and UPS management cards automatically (manual SNMP card entry is always possible).
          </p>

          <p className="text-sm text-zinc-400">
            Prefer isolating power management on a separate VLAN or IoT segment?
            Controller OS fully supports that.
          </p>

          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Tagged + untagged VLAN support</li>
            <li>• Multiple VLANs on a single port (trunk mode)</li>
            <li>• Dual-NIC mode: LAN 1 + LAN 2 = separate networks</li>
          </ul>

          <p className="text-xs text-zinc-500">
            Goal: keep power control reachable even if the main network is under
            maintenance or partially down.
          </p>
        </div>

        <div className="pg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            Security, updates &amp; lifecycle
          </h2>

          <p className="text-sm text-zinc-300">
            Controller OS is built as a long-lived, secure appliance.
          </p>

          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Encrypted Controller ↔ Connector sync</li>
            <li>• Credential vault for SNMP, SSH and API tokens</li>
            <li>• Optional MFA + role-based access</li>
            <li>• Signed OTA updates (Controller + Connector)</li>
            <li>• Automatic backups to S3-compatible storage</li>
          </ul>

          <p className="text-xs text-zinc-500">
            No mandatory cloud accounts. You stay fully in control.
          </p>
        </div>
      </section>

      {/* PLATFORM CARD */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
          Where Controller OS runs best
        </h2>

        <p className="text-sm text-zinc-300">
          Recommended platform: NanoPi R3S (dual-NIC) for a dedicated power-management plane.
          But Controller OS also runs perfectly on VMs and Docker environments.
        </p>

        <div className="grid gap-4 md:grid-cols-3 text-sm text-zinc-400">
          <div>
            <div className="text-xs font-semibold text-zinc-200 mb-1">
              NanoPi R3S
            </div>
            <p className="text-xs">
              Low-power, dual-NIC, perfect dedicated management node.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-200 mb-1">
              Virtual machine
            </div>
            <p className="text-xs">
              Ideal when you already run a UPS-backed hypervisor cluster.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-200 mb-1">
              Docker / Container
            </div>
            <p className="text-xs">
              Integrates well into existing infrastructure or lab setups.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pg-card p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Ready to clean up your UPS landscape?
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl">
            Start with one Controller and one Connector next to your first UPS.
            Scale from homelab to multi-site. PowerGuardian grows with you.
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
            Review Connector setup
          </a>
        </div>
      </section>
    </div>
  );
}
