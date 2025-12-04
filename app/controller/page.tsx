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

      {/* NETWORKING & VLAN DESIGN */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="text-sm font-semibold tracking-[0.18em] text-zinc-500 uppercase">
          Networking &amp; VLAN design
        </h2>
        <p className="text-sm text-zinc-300 max-w-3xl">
          Controller OS is designed to live on a dedicated management network,
          so that power control stays reachable even when the rest of your
          infrastructure is under maintenance or misconfigured.
        </p>

        <div className="grid gap-6 md:grid-cols-2 text-sm text-zinc-300">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Single-LAN setups
            </h3>
            <p className="text-xs md:text-sm text-zinc-400">
              In a simple deployment, LAN 1 behaves like any normal interface.
              As long as Connectors and UPS management cards live in the same
              network, Controller OS will discover them automatically. Manual
              addition of network-based management cards is supported if needed.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Segmented &amp; dual-NIC setups
            </h3>
            <p className="text-xs md:text-sm text-zinc-400">
              Prefer to keep your IoT or UPS devices in a separate segment?
              Controller OS understands VLANs and handles tagged and untagged
              traffic on the same port. You can:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-zinc-400">
              <li>Expose multiple VLANs on a single NIC (tagged / untagged)</li>
              <li>
                Use LAN 1 for your regular homelab network and LAN 2 for a
                dedicated UPS / IoT segment
              </li>
              <li>
                Keep the power-plane reachable through VPN or a jump-host, even
                when production routing is broken
              </li>
            </ul>
          </div>
        </div>
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