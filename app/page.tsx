export default function Home() {
  return (
    <div className="space-y-16">
      
      {/* HERO SECTION */}
      <section className="text-center space-y-6 py-10">
        <h1 className="text-4xl md:text-5xl font-extrabold">
          Power orchestration for{" "}
          <span className="text-[#00C66F]">UPS & Energy Systems</span>.
        </h1>

        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
          PowerGuardian is a next-generation platform for UPS management,
          connector orchestration, automation rules, secure shutdown chains,
          VLAN-aware networking & OTA updates. Designed for professionals.
        </p>

        <div className="flex flex-wrap gap-4 justify-center pt-4">
          <a
            href="/controller"
            className="px-6 py-3 rounded-xl bg-[#00C66F] text-black font-semibold hover:bg-[#00d979] transition"
          >
            Explore Controller OS
          </a>

          <a
            href="/connector"
            className="px-6 py-3 rounded-xl border border-zinc-700 hover:border-[#00C66F] text-zinc-300 hover:text-white transition"
          >
            Explore Connector OS
          </a>
        </div>
      </section>


      {/* FEATURES SECTION */}
      <section className="grid md:grid-cols-3 gap-6">
        <Card 
          title="UPS Autodiscovery" 
          text="USB, HID & SNMP UPS detection without manual drivers or configuration." 
        />
        <Card 
          title="Zero-Touch Connector Adoption" 
          text="Connectors announce themselves automatically and securely connect to the Controller." 
        />
        <Card 
          title="Rules & Automations" 
          text="Create shutdown workflows, device priorities, NAS protection rules and event triggers." 
        />
      </section>


      {/* LIVE TOPOLOGY PREVIEW (FAKE DEMO) */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-xl font-semibold mb-3 text-[#00C66F]">
          Live Topology Preview
        </h2>

        <p className="text-zinc-400 text-sm mb-4">
          A visual preview of how PowerGuardian orchestrates your power
          infrastructure across Connectors, Controllers and UPS devices.
        </p>

        <div className="grid gap-4 text-sm">
          <DeviceCard
            name="Connector-NEO3-01"
            desc="APC Smart-UPS USB"
            status="Online"
            runtime="42 min"
          />
          <DeviceCard
            name="Connector-NEO3-02"
            desc="Eaton 5P SNMP"
            status="On Battery"
            runtime="Rule: shutdown NAS @ 5 min"
          />
          <DeviceCard
            name="ControllerOS"
            desc="Vault, OTA, VLAN, Automation Engine"
            status="Healthy"
            runtime="Backup: 3 minutes ago"
          />
        </div>
      </section>
    </div>
  );
}


function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-xl shadow-lg hover:border-[#00C66F] transition">
      <h3 className="text-lg font-semibold mb-2 text-[#00C66F]">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function DeviceCard({
  name,
  desc,
  status,
  runtime,
}: {
  name: string;
  desc: string;
  status: string;
  runtime: string;
}) {
  return (
    <div className="bg-black/40 border border-zinc-800 rounded-xl px-5 py-3 flex items-center justify-between">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-zinc-500 text-xs">{desc}</div>
      </div>

      <div className="text-right">
        <div className="font-semibold text-[#00C66F]">{status}</div>
        <div className="text-zinc-500 text-xs">{runtime}</div>
      </div>
    </div>
  );
}