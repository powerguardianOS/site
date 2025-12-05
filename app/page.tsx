// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* HERO */}
      <section className="grid gap-10 md:grid-cols-[3fr,2fr] items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Self-hosted UPS orchestration
          </div>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            One control plane for{" "}
            <span className="text-[#00C66F]">UPS &amp; power</span> infrastructure.
          </h1>

          <p className="text-zinc-400 text-lg max-w-xl">
            PowerGuardian gives you a zero-touch control plane for UPS devices:
            one dashboard, multi-vendor support, safe shutdown rules and
            OTA-managed connectors. No cloud lock-in, no fragile scripts.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/downloads"
              className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[0_0_35px_rgba(0,198,111,0.45)]"
            >
              Download Connector OS images
            </Link>
            <Link
              href="/controller"
              className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
            >
              Explore Controller OS
            </Link>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00C66F]" />
              <span>USB · SNMP · NMC autodiscovery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00C66F]" />
              <span>Self-hosted, encrypted and rule-driven</span>
            </div>
          </div>
        </div>

        {/* Architecture side card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-5">
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
              <span className="mx-2 text-[10px] tracking-[0.22em] uppercase text-zinc-500">
                Encrypted sync
              </span>
              <div className="h-px w-12 bg-zinc-700" />
            </div>
            <DiagramRow
              title="Connector OS"
              subtitle="Local UPS agent · NUT-based · buffered events, OTA-managed"
              badge="NanoPi Neo3"
            />
          </div>
          <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
            PowerGuardian builds on NUT (Network UPS Tools), but handles
            drivers, discovery, rules and shutdown mapping for you. No scattered
            scripts, no manual config hunts—just one orchestration layer.
          </p>
        </div>
      </section>

      {/* CONNECTOR VS CONTROLLER */}
      <section className="grid gap-6 md:grid-cols-2">
        <ProductCard
          label="Edge agent"
          title="Connector OS"
          description="Runs next to your UPS. Autodetects USB, SNMP and network cards, and executes local shutdown rules when the controller is unreachable."
          bullets={[
            "NUT under the hood, fully preconfigured",
            "UPS identify (beep), autodetected drivers & capabilities",
            "Local rules for NAS, hypervisors and switches",
            "OTA updates from Controller, signed per release",
          ]}
          href="/connector"
        />
        <ProductCard
          label="Control plane"
          title="Controller OS"
          description="Your central dashboard for power. Adopt connectors, map UPS devices to hosts and racks, and define power-down sequences per site."
          bullets={[
            "Zero-touch adoption for new connectors",
            "Inventory + shutdown mapping per server and rack",
            "Credential vault, MFA-ready, role-based access",
            "Backups, Google Drive sync and optional cloud proxy",
          ]}
          href="/controller"
        />
      </section>

      {/* WHY NOT JUST A UPS CARD? */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 md:p-7 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
          WHY NOT JUST A VENDOR UPS CARD?
        </h2>
        <p className="text-zinc-300 text-sm md:text-base max-w-3xl">
          A vendor-specific SNMP card protects one UPS and one stack. With
          PowerGuardian you orchestrate multiple UPS units, brands and racks in
          one system. Shutdown sequences, VLAN segmentation and credentials are
          centralized—while you stay fully in control of your data.
        </p>
        <div className="grid gap-3 md:grid-cols-3 text-xs text-zinc-400">
          <CompareItem
            title="Multi-vendor"
            body="Eaton, APC and generic HID UPS: all visible in one dashboard and rule engine."
          />
          <CompareItem
            title="Infra-aware"
            body="Map UPS devices to hosts, clusters and VLANs—not just IP addresses."
          />
          <CompareItem
            title="Future-ready"
            body="Connector images, OTA updates and R2 downloads keep upgrades manageable."
          />
        </div>
      </section>

      {/* CAPABILITIES GRID */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            PowerGuardian capabilities
          </h2>
          <span className="text-xs text-zinc-500">
            Designed for real-world racks, homelabs and small data centers.
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            title="UPS autodiscovery"
            text="Scan USB, SNMP and NMC cards to detect model, runtime, battery status and capabilities without manual driver hunting."
          />
          <FeatureCard
            title="Rule-based shutdown"
            text="Map UPS devices to hosts and services. Define who powers down first and who stays up until the last minute."
          />
          <FeatureCard
            title="VLAN-aware design"
            text="Use a dual-NIC controller as a dedicated management node for your power plane, separate from production traffic."
          />
          <FeatureCard
            title="Encrypted credential vault"
            text="Store SNMP communities, SSH users and API tokens in an encrypted vault. No more passwords in random config files."
          />
          <FeatureCard
            title="Cloudflare R2 distribution"
            text="Serve connector images and updates from Cloudflare R2 with global CDN performance."
          />
          <FeatureCard
            title="OTA for connectors"
            text="Plan connector upgrades from the controller with signed packages and anti-cloning checks per node."
          />
        </div>
      </section>

      {/* USE CASES */}
      <section className="grid gap-4 md:grid-cols-3">
        <UseCaseCard
          title="Homelab"
          text="One UPS, one Connector, one Controller VM. Clean shutdown for your NAS, hypervisor and router without manual scripting."
        />
        <UseCaseCard
          title="Small business rack"
          text="Multiple UPS units across a single rack. Map each UPS to critical and non-critical systems with staged shutdown."
        />
        <UseCaseCard
          title="Multi-site"
          text="Connectors in different locations feeding one central Controller OS, accessible over secure VPN or dedicated management network."
        />
      </section>

      {/* FAQ / BOTTOM CTA */}
      <section className="grid gap-10 md:grid-cols-[3fr,2fr] items-start">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">FAQ</h2>
          <FaqItem
            q="Do I need internet access for PowerGuardian?"
            a="No. PowerGuardian is designed to be fully self-hosted. Internet is only needed for downloading images and updates, which can also be mirrored internally."
          />
          <FaqItem
            q="Which UPS brands are supported?"
            a="PowerGuardian builds on NUT, so many APC, Eaton and generic HID UPS devices work out of the box. The goal is to publish a clear compatibility list over time."
          />
          <FaqItem
            q="Can I run the controller in a VM?"
            a="Yes. Controller OS can run on a NanoPi R3S, a dedicated x86 box or as a VM / Docker container in your homelab or rack."
          />
          <FaqItem
            q="What happens if the controller is down?"
            a="Connectors keep running local rules. Buffered events sync back to the controller once connectivity is restored."
          />
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
          <h3 className="text-lg font-semibold tracking-tight">
            Ready to clean up your power stack?
          </h3>
          <p className="text-sm text-zinc-400">
            Start with a single UPS, one Connector and one Controller instance.
            Grow from a homelab to a full rack—without changing tools.
          </p>
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
              Learn more about Controller OS
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* -------- Helper components (same file for now) -------- */

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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
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
      <Link
        href={props.href}
        className="inline-flex items-center gap-2 text-xs text-[#00C66F] hover:text-[#1af189] mt-2"
      >
        Open {props.title}
        <span className="text-[11px]">↗</span>
      </Link>
    </div>
  );
}

function FeatureCard(props: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-2">
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

function UseCaseCard(props: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-white">{props.title}</h3>
      <p className="text-xs text-zinc-400">{props.text}</p>
    </div>
  );
}

function FaqItem(props: { q: string; a: string }) {
  return (
    <div className="border-b border-zinc-800 pb-3">
      <div className="text-sm font-medium text-zinc-100 mb-1">{props.q}</div>
      <p className="text-xs text-zinc-500">{props.a}</p>
    </div>
  );
}
