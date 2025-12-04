// app/controller/page.tsx

export default function ControllerPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-16 space-y-16">
      {/* HERO */}
      <section className="space-y-6">
        <div className="pg-pill">Control plane · UPS orchestration</div>

        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Controller OS – the central brain of your power stack.
        </h1>

        <p className="text-zinc-400 max-w-2xl text-sm md:text-base">
          PowerGuardian Controller OS provides a unified, self-hosted control
          plane for UPS environments across brands, sites and network
          segments. Zero-touch adoption of Connector OS nodes, a flexible
          rule engine, VLAN-aware networking and secure OTA updates — all
          managed from one clean dashboard.
        </p>

        <div className="flex flex-wrap gap-3">
          <a
            href="/downloads"
            className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[0_0_32px_rgba(0,198,111,0.35)]"
          >
            Download Controller OS image
          </a>
          <a
            href="/connector"
            className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
          >
            Explore Connector OS
          </a>
        </div>
      </section>

      {/* ARCHITECTURE SNAPSHOT */}
      <section className="space-y-6">
        <h2 className="text-xs font-semibold tracking-[0.25em] text-zinc-500 uppercase">
          Architecture snapshot
        </h2>

        <div className="pg-card p-6 md:p-7 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 text-sm text-zinc-300">
              <h3 className="text-sm font-semibold text-white">Controller OS</h3>
              <p className="text-zinc-400 text-sm">
                Runs as your central dashboard and rule engine. Discovers
                Connectors, keeps an inventory of UPS devices and enforces
                shutdown policies across racks, rooms and sites.
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-zinc-400">
                <li>Central rule engine for shutdown sequencing and policies</li>
                <li>Inventory of UPS devices, hosts and racks</li>
                <li>Credential vault for SNMP, SSH and API tokens</li>
                <li>Secure OTA controller for Connector OS nodes</li>
              </ul>
            </div>

            <div className="space-y-3 text-sm text-zinc-300">
              <h3 className="text-sm font-semibold text-white">
                Connectors &amp; encrypted sync
              </h3>
              <p className="text-zinc-400 text-sm">
                Connector OS runs next to each UPS and talks to Controller OS
                over an encrypted sync channel. Even if the Controller is
                temporarily unreachable, local rules continue to protect your
                equipment.
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-zinc-400">
                <li>One Controller can manage many Connectors and UPS devices</li>
                <li>Buffered events and state sync when links come back</li>
                <li>Safe shutdown even if parts of the network are down</li>
                <li>Designed for multi-site / multi-rack environments</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HARDWARE & DEPLOYMENT */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="pg-card p-6 md:p-7 space-y-4">
          <h2 className="text-sm font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Preferred platforms
          </h2>
          <p className="text-sm text-zinc-300">
            Controller OS is built to run on small, reliable platforms with
            dual-NIC capability or as a lightweight VM.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-zinc-400">
            <li>NanoPi R3S as a fanless, dual-NIC controller node</li>
            <li>Virtual machine on your hypervisor (Proxmox, ESXi, etc.)</li>
            <li>Container or Docker-based deployments for labs and CI</li>
            <li>
              Designed for 24/7 uptime with minimal CPU, RAM and storage
              requirements
            </li>
          </ul>
        </div>

        <div className="pg-card p-6 md:p-7 space-y-4">
          <h2 className="text-sm font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Core capabilities
          </h2>
          <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-zinc-400">
            <li>Unified control plane for multi-vendor UPS environments</li>
            <li>
              Zero-touch discovery and adoption of Connector OS nodes on the
              network
            </li>
            <li>
              Rule engine for ordered shutdown, delays and dependency-aware
              logic
            </li>
            <li>
              Global view of runtime, battery health and recent power events
            </li>
            <li>
              Credential vault, MFA-ready design and role-based access control
              (RBAC)
            </li>
          </ul>
        </div>
      </section>

      {/* VLAN & NETWORK DESIGN */}
<section className="pg-card p-6 md:p-7 space-y-4">
  <h2 className="pg-section-title">VLAN &amp; Network Design</h2>

  <p className="text-sm text-zinc-300 max-w-3xl">
    Controller OS keeps your power-management layer reachable even when the rest
    of your network changes, reboots or breaks. Whether you run a simple LAN or
    a segmented enterprise-style setup — PowerGuardian fully understands it.
  </p>

  <ul className="space-y-2 text-sm text-zinc-400 mt-3">
    <li>
      • <span className="font-medium text-white">Simple mode (LAN1):</span>
      Works like any normal interface. If Controller OS and your Connectors/UPS
      management cards are in the same network, discovery is automatic.
      <span className="text-zinc-500"> Manual add is always supported.</span>
    </li>

    <li>
      • <span className="font-medium text-white">VLAN-aware mode:</span>
      Controller OS understands both <span className="text-white">tagged</span> and{" "}
      <span className="text-white">untagged</span> VLANs.  
      Present multiple VLANs on one switchport and the controller listens on
      every network you expose — ideal for IoT, UPS-only or restricted segments.
    </li>

    <li>
      • <span className="font-medium text-white">Dual-NIC isolation:</span>
      Running on hardware like the NanoPi R3S, you can fully isolate traffic:
      <br />
      <span className="text-white">LAN1 → Main LAN / homelab</span>
      <br />
      <span className="text-white">LAN2 → UPS / IoT / management VLAN</span>
      <br />
      Perfect when you want power control reachable even if your main LAN is
      down or under maintenance.
    </li>
  </ul>

  <p className="text-xs text-zinc-500 mt-3 max-w-2xl">
    The idea is simple: the Controller should always be reachable — even when
    routing breaks, VLANs change, or noisy devices misbehave. Your power
    orchestration layer stays stable, no matter what happens around it.
  </p>
</section>

      {/* RULE ENGINE & OTA */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="pg-card p-6 md:p-7 space-y-3">
          <h2 className="text-sm font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Rule engine
          </h2>
          <p className="text-sm text-zinc-300">
            Define exactly how your infrastructure reacts during power events.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-zinc-400">
            <li>
              Multi-stage shutdown ordering with delays between hosts and
              services
            </li>
            <li>
              Cluster-aware behaviour for hypervisors, NAS systems and switches
            </li>
            <li>
              Battery-level and runtime thresholds for different emergency modes
            </li>
            <li>
              Rules that continue to work locally via Connectors if the
              Controller is temporarily offline
            </li>
          </ul>
        </div>

        <div className="pg-card p-6 md:p-7 space-y-3">
          <h2 className="text-sm font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Updates, backups &amp; security
          </h2>
          <p className="text-sm text-zinc-300">
            Controller OS keeps your power stack maintainable without handing
            control to an external cloud.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-zinc-400">
            <li>Signed OTA updates for Connector OS nodes</li>
            <li>Versioned configuration and scheduled backups</li>
            <li>
              Optional off-site backups to providers such as Google Drive or
              S3-compatible storage
            </li>
            <li>
              Clear separation between management network and production
              workloads
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
