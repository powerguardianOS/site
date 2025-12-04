// app/roadmap/page.tsx
export default function RoadmapPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Roadmap</h1>
        <p className="text-sm md:text-base text-zinc-400 max-w-2xl">
          PowerGuardian is evolving from a homelab-friendly project into a
          robust orchestration layer for serious racks and small data centers.
          This roadmap gives a rough idea of where things are headed.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <RoadmapCard
          title="Foundations"
          when="Current phase"
          items={[
            "Connector OS base image for NanoPi Neo3",
            "Controller OS with basic dashboard",
            "UPS autodiscovery via USB and SNMP",
            "Rule engine for simple shutdown sequences",
          ]}
        />
        <RoadmapCard
          title="Hardening"
          when="Next"
          items={[
            "Credential vault with encryption",
            "Anti-cloning for connectors",
            "OTA update pipeline for Connector OS",
            "Improved logging and event history",
          ]}
        />
        <RoadmapCard
          title="Ecosystem"
          when="Later"
          items={[
            "Expanded UPS compatibility list",
            "More boards (Pi, x86 thin clients)",
            "Optional integrations (hypervisors, HA stacks)",
            "Better visualization and reporting",
          ]}
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Feedback &amp; community
        </h2>
        <p className="text-sm text-zinc-400 max-w-3xl">
          The roadmap is intentionally flexible. Real-world feedback from
          homelabs, small businesses and event venues will shape which UPS
          models, boards and integrations get prioritized.
        </p>
        <p className="text-xs text-zinc-500">
          Over time, this page can link to a GitHub project board, issue
          labels, or a dedicated community space.
        </p>
      </section>
    </div>
  );
}

function RoadmapCard(props: {
  title: string;
  when: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-3">
      <div className="text-xs font-semibold text-emerald-400 uppercase tracking-[0.18em]">
        {props.when}
      </div>
      <h2 className="text-sm font-semibold text-zinc-100">{props.title}</h2>
      <ul className="space-y-1 text-xs text-zinc-400">
        {props.items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
