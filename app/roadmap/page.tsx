// app/roadmap/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "Where PowerGuardian is headed — from v1.0 launch through cloud features and enterprise capabilities.",
};

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-8 space-y-12 md:space-y-16">
      <section className="space-y-3">
        <h1 className="pg-display text-5xl text-white">Roadmap</h1>
        <p className="text-sm md:text-base text-zinc-400 max-w-2xl">
          PowerGuardian ships as a self-hosted appliance with a SaaS license.
          Here's what's live today and where we're taking it next.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <RoadmapCard
          title="v1.0 — Available Now"
          when="Live"
          accent="#3fb950"
          items={[
            "Connector management with adoption & revocation",
            "UPS monitoring via NUT and SNMP (RFC 1628)",
            "Encrypted vault for credentials and secrets",
            "Customizable alert rules and notification flows",
            "TOTP MFA, email OTP, and Ed25519 JWT auth",
            "Cloudflare Tunnel for secure remote access",
            "Over-the-air OTA updates for connectors",
            "License system — Home · Pro · Enterprise",
          ]}
        />
        <RoadmapCard
          title="Cloud Features"
          when="Coming soon"
          accent="#00C66F"
          items={[
            "Admin portal at admin.powerguardian.cloud",
            "License management dashboard for founders",
            "Multi-site overview across all deployments",
            "Remote monitoring with real-time alerts",
            "License activation via email verification",
            "Subscription self-service portal",
          ]}
        />
        <RoadmapCard
          title="Enterprise"
          when="Later"
          accent="#64748b"
          items={[
            "White-label branding for MSPs and resellers",
            "SNMP trap receiver for passive event ingestion",
            "Grafana integration for advanced dashboards",
            "High-availability controller clustering",
            "REST API for external automation systems",
            "Outlet-level switching and load management",
          ]}
        />
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent p-6 space-y-3">
        <h2 className="pg-display text-2xl md:text-3xl text-white">
          Shaped by real infrastructure
        </h2>
        <p className="text-sm text-zinc-400 max-w-3xl">
          The roadmap is driven by what homelabs, small businesses, and colocation
          customers actually run into. Have a UPS model that isn't supported, a
          board that should be, or an integration that would save you hours?{" "}
          <a
            href="mailto:hello@powerguardian.cloud"
            className="text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Let us know.
          </a>
        </p>
      </section>
    </div>
  );
}

function RoadmapCard(props: {
  title: string;
  when: string;
  accent: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent p-5 space-y-3">
      <div
        className="text-xs font-semibold uppercase tracking-[0.18em]"
        style={{ color: props.accent }}
      >
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
