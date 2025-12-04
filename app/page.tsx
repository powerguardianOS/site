export default function Home() {
  return (
    <div className="space-y-16">
      {/* HERO */}
      <section className="grid gap-10 md:grid-cols-[3fr,2fr] items-center">
        <div className="space-y-6">
          <div className="pg-pill">UPS orchestration · self-hosted</div>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Power orchestration for{" "}
            <span className="text-[#00C66F]">UPS &amp; energy</span> networks.
          </h1>

          <p className="text-zinc-400 text-lg max-w-xl">
            PowerGuardian is your zero-touch control plane for UPS devices:
            one dashboard, zero vendor lock-in, full control over shutdown
            automation, VLAN-aware networking and OTA updates — fully self-hosted.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="/controller"
              className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[0_0_30px_rgba(0,198,111,0.4)]"
            >
              Explore Controller OS
            </a>
            <a
              href="/connector"
              className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
            >
              Explore Connector OS
            </a>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00C66F]" />
              <span>USB · SNMP · NMC autodiscovery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00C66F]" />
              <span>Secure, self-hosted, no cloud lock-in</span>
            </div>
          </div>
        </div>

        {/* HERO SIDE CARD */}
        <div className="pg-card p-5 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            ARCHITECTURE
          </h2>
          <div className="space-y-4 text-sm text-zinc-300">
            <DiagramRow
              title="Controller OS"
              subtitle="Central dashboard · rule engine · credential vault · VLAN segmentation"
              badge="NanoPi R3S"
            />
            <div className="flex items-center justify-center">
              <div className="h-px w-12 bg-zinc-700" />
              <span className="mx-2 text-[10px] tracking-[0.2em] uppercase text-zinc-500">
                Encrypted sync
              </span>
              <div className="h-px w-12 bg-zinc-700" />
            </div>
            <DiagramRow
              title="Connector OS"
              subtitle="Local UPS daemon · NUT-based · buffered events + OTA"
              badge="NanoPi Neo3"
            />
          </div>
          <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
            PowerGuardian builds on NUT (Network UPS Tools), but handles drivers,
            autodiscovery, rules and shutdown mapping for you. No more scattered
            scripts — one consolidated stack.
          </p>
        </div>
      </section>

      {/* CONNECTOR VS CONTROLLER */}
      <section className="grid gap-6 md:grid-cols-2">
        <ProductCard
          label="Edge agent"
          title="Connector OS"
          description="Runs next to your UPS. Detects USB, SNMP and network cards, and executes local shutdown rules when the controller is unreachable."
          bullets={[
            "NUT under the hood, but fully pre-configured",
            "Identify UPS hardware, detect drivers & capabilities",
            "Local rule engine for NAS, hypervisors and switches",
            "OTA updates from the Controller with signed packages",
          ]}
          href="/connector"
        />

        <ProductCard
          label="Control plane"
          title="Controller OS"
          description="Your central dashboard for everything power-related: adopt connectors, map UPS devices, define rules and manage automated shutdown sequences."
          bullets={[
            "Zero-touch adoption of new connectors",
            "Device inventory + shutdown mapping per host or rack",
            "Credential vault, MFA, user roles and SSH policy",
            "Google Drive backups and optional cloud relay",
          ]}
          href="/controller"
        />
      </section>

      {/* WHY NOT A UPS CARD? */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
          WHY NOT A VENDOR SNMP CARD?
        </h2>
        <p className="text-zinc-300 text-sm md:text-base max-w-3xl">
          A vendor-specific SNMP card protects one UPS and one environment.
          PowerGuardian orchestrates multiple UPS units, brands and locations
          inside a single system. Shutdown sequencing, VLAN segmentation and
          credential management are centralized — while you keep full ownership
          of your data.
        </p>
        <div className="grid gap-3 md:grid-cols-3 text-xs text-zinc-400">
          <CompareItem
            title="Multi-vendor"
            body="Eaton, APC and generic HID UPS devices — all in one dashboard and rule engine."
          />
          <CompareItem
            title="Infra-aware"
            body="Map UPS units to hosts, clusters and VLANs instead of plain IP addresses."
          />
          <CompareItem
            title="Future-proof"
            body="Connector OS images, OTA and R2 downloads make upgrades predictable and safe."
          />
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            PowerGuardian capabilities
          </h2>
          <span className="text-xs text-zinc-500">
            Designed from day one for real-world datacenters & homelabs.
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            title="UPS autodiscovery"
            text="Scan USB, SNMP and NMC cards; detect model, runtime, battery state and device capabilities without manual driver work."
          />
          <FeatureCard
            title="Rules & shutdown mapping"
            text="Link UPS units to hosts and services. Define who powers down first — and who stays online until the last seconds."
          />
          <FeatureCard
            title="VLAN-aware networking"
            text="Use a dual-NIC controller (e.g. NanoPi R3S) as a dedicated management node for your power-plane."
          />
          <FeatureCard
            title="Credential vault"
            text="Encrypted storage for SNMP communities, SSH users and API tokens. No more loose config files."
          />
          <FeatureCard
            title="R2-powered downloads"
            text="Connector images, OS updates and tools are delivered globally through Cloudflare R2 + CDN."
          />
          <FeatureCard
            title="OTA for Connectors"
            text="Schedule connector updates via the Controller with signed packages and anti-cloning checks."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="pg-card p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Ready to streamline your power infrastructure?
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl">
            Start with one Controller and one Connector next to your first UPS.
            Expand gradually. PowerGuardian scales with you — from homelab to SMB
            racks to full datacenter deployments.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/downloads"
            className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition"
          >
            Download Connector images
          </a>
          <a
            href="/network"
            className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
          >
            View network & VLAN design
          </a>
        </div>
      </section>
    </div>
  );
}

/* ------- Helper components ------- */

function DiagramRow(props: {
  title: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{props.title}</h3>
        <span className="rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
          {props.badge}
        </span>
      </div>
      <p className="text-xs text-zinc-400">{props.subtitle}</p>
    </div>
  );
}

function ProductCard(props: {
  label: string;
  title: string;
  description: string;
  bullets: string[];
  href: string;
}) {
  return (
    <div className="pg-card p-6 space-y-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {props.label}
      </div>
      <h3 className="text-xl font-semibold">{props.title}</h3>
      <p className="text-sm text-zinc-300">{props.description}</p>
      <ul className="space-y-2 text-sm text-zinc-400">
        {props.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <a
        href={props.href}
        className="inline-flex items-center gap-2 text-xs text-[#00C66F] hover:text-[#1af189] mt-2"
      >
        Open {props.title}
        <span className="text-[11px]">↗</span>
      </a>
    </div>
  );
}

function FeatureCard(props: { title: string; text: string }) {
  return (
    <div className="pg-card p-4 space-y-2">
      <h3 className="text-sm font-semibold text-white">{props.title}</h3>
      <p className="text-xs text-zinc-400">{props.text}</p>
    </div>
  );
}

function CompareItem(props: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-zinc-200">{props.title}</div>
      <p className="text-xs text-zinc-500">{props.body}</p>
    </div>
  );
}
