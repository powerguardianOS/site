export default function ConnectorPage() {
  return (
    <div className="space-y-14">
      {/* HERO */}
      <section className="grid gap-10 md:grid-cols-[3fr,2fr] items-start">
        <div className="space-y-6">
          <div className="pg-pill">Connector OS · edge UPS agent</div>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Zero-touch UPS agents,{" "}
            <span className="text-[#00C66F]">right next to your power</span>.
          </h1>

          <p className="text-zinc-400 text-lg max-w-xl">
            Connector OS runs next to your UPS devices and speaks USB, SNMP and
            network management cards. It buffers events locally, executes
            shutdown rules when needed and keeps the Controller in sync when the
            network is healthy.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="/downloads"
              className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition shadow-[0_0_30px_rgba(0,198,111,0.4)]"
            >
              Download Connector images
            </a>
            <a
              href="/"
              className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
            >
              Back to overview
            </a>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            <TagDot>Built on NUT (Network UPS Tools)</TagDot>
            <TagDot>Offline-safe: local rules &amp; buffering</TagDot>
            <TagDot>Managed centrally via Controller OS</TagDot>
          </div>
        </div>

        {/* ARCHITECTURE CARD */}
        <div className="pg-card p-5 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
            HOW IT FITS IN
          </h2>
          <p className="text-sm text-zinc-300">
            Connector OS is the small, hardened edge agent that sits right next
            to your UPS. It discovers devices, normalises metrics and exposes a
            secure channel to Controller OS.
          </p>

          <div className="space-y-3 text-xs text-zinc-400">
            <ArchRow
              title="UPS devices"
              body="USB HID, SNMP cards, network-attached UPS units."
            />
            <ConnectorArrow label="Local NUT + drivers" />
            <ArchRow
              title="Connector OS"
              body="Discovers devices, collects metrics, runs local rule engine, buffers events."
            />
            <ConnectorArrow label="Encrypted sync" />
            <ArchRow
              title="Controller OS"
              body="Global dashboard, rule editor, inventory, backups and OTA orchestration."
            />
          </div>

          <p className="text-[11px] text-zinc-500 border-t border-zinc-800 pt-3">
            If the Controller goes offline, Connector OS keeps enforcing local
            shutdown rules so your infrastructure is still protected.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            What Connector OS does for you
          </h2>
          <span className="text-xs text-zinc-500">
            Focus on your servers and network, not on UPS quirks.
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            title="Autodiscovery & drivers"
            text="Scans USB and SNMP endpoints, picks appropriate NUT drivers and detects capabilities such as runtime, battery state and load."
          />
          <FeatureCard
            title="Local rule engine"
            text="Executes shutdown sequences even when the Controller is unreachable. Protects NAS devices, hypervisors and switches on the same LAN."
          />
          <FeatureCard
            title="Buffered events"
            text="Stores power events and metrics locally during outages and syncs them back to the Controller once connectivity returns."
          />
          <FeatureCard
            title="Secure by default"
            text="All communication to Controller OS uses mTLS and per-node identities, making anti-cloning and revocation straightforward."
          />
          <FeatureCard
            title="OTA updates"
            text="Receives image and package upgrades from Controller OS, with signed artifacts and version pinning per connector."
          />
          <FeatureCard
            title="Simple troubleshooting"
            text="Expose logs and metrics via the web UI so you can debug a single connector without SSHing into boxes all night."
          />
        </div>
      </section>

      {/* SUPPORTED PLATFORMS */}
      <section className="pg-card p-6 md:p-7 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Optimised for small, reliable edge boxes
            </h2>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Connector OS is designed for silent, low-power nodes that you can
              bolt into a rack or stick behind a UPS. No full server required.
            </p>
          </div>
          <span className="text-xs text-zinc-500">
            More boards will be added as the project evolves.
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3 text-sm text-zinc-300">
          <PlatformCard
            title="NanoPi Neo3"
            role="Primary reference platform"
            bullets={[
              "Gigabit Ethernet, small footprint",
              "Perfect to sit on top of a single UPS",
              "Runs from SD or eMMC images",
            ]}
          />
          <PlatformCard
            title="Raspberry Pi (3/4/5)"
            role="Homelab & lab setups"
            bullets={[
              "Great for testing and small deployments",
              "USB-heavy environments with multiple UPS devices",
              "Same management experience as NanoPi",
            ]}
          />
          <PlatformCard
            title="Other ARM / x86"
            role="Generic edge nodes"
            bullets={[
              "As long as Linux + NUT are happy, Connector OS can follow",
              "Ideal for repurposed thin clients or fanless boxes",
              "Documented images and install paths planned",
            ]}
          />
        </div>
      </section>

      {/* POWER EVENT FLOW */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          When the power actually fails
        </h2>
        <div className="pg-card p-6 space-y-4 text-sm text-zinc-300">
          <TimelineRow
            step="01"
            title="UPS signals a problem"
            body="On-battery, low runtime, or communication loss — Connector OS receives events directly from the UPS via USB/SNMP."
          />
          <TimelineRow
            step="02"
            title="Rules evaluate locally"
            body="The local rule engine checks thresholds and mappings sourced from Controller OS, but stored safely on the connector."
          />
          <TimelineRow
            step="03"
            title="Shutdown sequence runs"
            body="NAS devices, hypervisors and switches are shut down in the order you defined. If the Controller is down, the connector still continues."
          />
          <TimelineRow
            step="04"
            title="State syncs back"
            body="Once power and connectivity are back, metrics and event history are synced to Controller OS for visibility and auditability."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="pg-card p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Start with a single Connector next to your main UPS
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl">
            Drop a NanoPi or Raspberry Pi next to your most critical UPS, flash
            Connector OS and adopt it into your Controller. From there, you can
            roll out more connectors at your own pace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/downloads"
            className="px-5 py-2.5 rounded-full bg-[#00C66F] text-black text-sm font-medium hover:bg-[#00b564] transition"
          >
            Get Connector OS image
          </a>
          <a
            href="/network"
            className="px-5 py-2.5 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:border-[#00C66F] hover:text-white transition"
          >
            View recommended network design
          </a>
        </div>
      </section>
    </div>
  );
}

/* --------- Small helper components --------- */

function TagDot(props: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-[#00C66F]" />
      <span>{props.children}</span>
    </div>
  );
}

function ArchRow(props: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-zinc-100">{props.title}</div>
      <p className="text-[11px] text-zinc-400">{props.body}</p>
    </div>
  );
}

function ConnectorArrow(props: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 uppercase tracking-[0.2em] my-1">
      <div className="h-px w-10 bg-zinc-700" />
      <span>{props.label}</span>
      <div className="h-px w-10 bg-zinc-700" />
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

function PlatformCard(props: {
  title: string;
  role: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-white">{props.title}</div>
        <div className="text-[11px] text-zinc-500">{props.role}</div>
      </div>
      <ul className="space-y-1 text-xs text-zinc-400">
        {props.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelineRow(props: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="h-7 w-7 rounded-full bg-[#00C66F] text-black text-xs font-semibold flex items-center justify-center">
          {props.step}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-white">{props.title}</div>
        <p className="text-xs text-zinc-400">{props.body}</p>
      </div>
    </div>
  );
}
