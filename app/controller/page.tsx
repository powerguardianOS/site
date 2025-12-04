/* app/controller/page.tsx */

export default function ControllerPage() {
  return (
    <div className="space-y-16">
      {/* HERO */}
      <section className="space-y-6">
        <div className="pg-pill">Central Orchestration Layer</div>

        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Controller OS  
          <span className="block text-[#00C66F]">The brain of your power plane.</span>
        </h1>

        <p className="text-zinc-400 text-lg max-w-2xl">
          PowerGuardian Controller OS provides a unified, self-hosted control plane
          for UPS environments across brands, sites and network segments.  
          Zero-touch adoption, a powerful rule engine, VLAN-aware networking and secure
          OTA updates — all managed from one clean interface.
        </p>
      </section>


      {/* ARCHITECTURE */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="pg-section-title">Architecture Overview</h2>

        <p className="text-sm text-zinc-300 max-w-3xl">
          Controller OS orchestrates every Connector and UPS in your environment.
          Connectors report realtime UPS telemetry, while Controller OS maps hosts,
          defines shutdown sequences, and pushes OTA updates across your deployment.
        </p>

        <ul className="text-sm text-zinc-400 space-y-2 mt-4">
          <li>• Central rule engine for multi-UPS orchestration</li>
          <li>• Zero-touch discovery and adoption of Connectors</li>
          <li>• Encrypted controller-connector sync</li>
          <li>• Signed update packages for secure OTA rollouts</li>
        </ul>
      </section>


      {/* VLAN + NETWORK DESIGN — REWRITTEN */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="pg-section-title">VLAN &amp; Network Design</h2>

        <p className="text-sm text-zinc-300 max-w-3xl">
          Love clean network segmentation? PowerGuardian has you covered.
          In a default setup, <span className="font-medium text-white">LAN1</span> behaves like a normal interface
          on your main network. As long as Controller OS resides in the same segment,
          it can automatically discover Connectors and UPS network cards  
          <span className="text-zinc-400">(manual add is always possible)</span>.
        </p>

        <ul className="space-y-2 text-sm text-zinc-400 mt-3">
          <li>
            • <span className="font-medium text-white">Simple mode:</span>  
            LAN1 on your primary LAN → automatic Connector & UPS discovery.
          </li>

          <li>
            • <span className="font-medium text-white">VLAN-aware mode:</span>  
            Controller OS understands both tagged and untagged traffic.  
            Present multiple VLANs on a single port from your switch — Controller OS
            will listen on each network without additional configuration.
          </li>

          <li>
            • <span className="font-medium text-white">Dual-NIC isolation:</span>  
            Prefer a dedicated UPS or IoT network?  
            Use LAN1 for your regular LAN and LAN2 for a fully isolated segment.
          </li>
        </ul>

        <p className="text-xs text-zinc-500 mt-3 max-w-2xl">
          The idea is simple: keep your power-control layer reachable and stable,
          even when the rest of the network is noisy, under maintenance, or being reconfigured.
        </p>
      </section>


      {/* RULE ENGINE */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="pg-section-title">Rule Engine</h2>

        <p className="text-sm text-zinc-300 max-w-3xl">
          Define exactly how your infrastructure behaves during a power event:
        </p>

        <ul className="space-y-2 text-sm text-zinc-400">
          <li>• Multi-host shutdown sequencing</li>
          <li>• Cluster-aware logic for hypervisors, NAS and switches</li>
          <li>• Battery-level thresholds and emergency modes</li>
          <li>• Host-to-UPS mapping for complex environments</li>
        </ul>
      </section>


      {/* CREDENTIAL VAULT */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="pg-section-title">Credential Vault</h2>

        <p className="text-sm text-zinc-300 max-w-3xl">
          All authentication is securely stored in an encrypted vault:
          SNMP communities, SSH credentials, API tokens and more.  
          Nothing stored in plain text, nothing scattered across configs.
        </p>
      </section>


      {/* SECURITY MODEL */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="pg-section-title">Security Model</h2>

        <ul className="space-y-2 text-sm text-zinc-400">
          <li>• Encrypted controller–connector communication</li>
          <li>• Hardware-bound identity per Connector</li>
          <li>• Anti-cloning protections</li>
          <li>• Root login disabled</li>
          <li>• Optional MFA for Controller UI</li>
          <li>• Signed update packages</li>
        </ul>
      </section>


      {/* CTA */}
      <section className="pg-card p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Ready to build your power-aware infrastructure?
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl">
            Get started with Controller OS and expand at your own pace.  
            Add Connectors, onboard UPS systems, and orchestrate your environment with confidence.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/downloads"
            className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition"
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
      </section>
    </div>
  );
}
