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
            PowerGuardian is your UniFi-style control plane for UPS devices:
            one dashboard, zero vendor lock-in, full control over shutdown
            rules, VLAN-aware networking and OTA updates.
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
              subtitle="Central dashboard · rules engine · credential vault · VLAN"
              badge="NanoPi R3S / VM / Docker"
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
              badge="NanoPi Neo3 / Pi"
            />
          </div>
          <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
            PowerGuardian bouwt op NUT (Network UPS Tools), maar regelt drivers,
            discovery, rules en shutdown-mapping voor je. Geen losse scripts
            meer, één geconsolideerde stack.
          </p>
        </div>
      </section>

      {/* CONNECTOR VS CONTROLLER */}
      <section className="grid gap-6 md:grid-cols-2">
        <ProductCard
          label="Edge agent"
          title="Connector OS"
          description="Draait naast je UPS. Autodetecteert USB, SNMP en network cards, en voert lokale shutdown-rules uit wanneer de controller niet bereikbaar is."
          bullets={[
            "NUT onder de motorkap, maar volledig voorgaconfigureerd",
            "UPS identify (beep), autodetect drivers & capabilities",
            "Local rules engine voor NAS / hypervisors / switches",
            "OTA updates via de Controller, met signed packages",
          ]}
          href="/connector"
        />
        <ProductCard
          label="Control plane"
          title="Controller OS"
          description="Je UniFi-stijl dashboard voor alles rond power: connectors adopteren, UPS-en mappen, rules definiëren en automatische shutdown-sequenties beheren."
          bullets={[
            "Zero-touch adoptie van nieuwe connectors",
            "Device inventory + shutdown mapping per server / rack",
            "Credential vault, MFA, user-roles en SSH-policy",
            "Google Drive backups en optionele cloud proxy",
          ]}
          href="/controller"
        />
      </section>

      {/* WHY NOT JUST A UPS CARD? */}
      <section className="pg-card p-6 md:p-7 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-[0.18em]">
          WAAROM GEEN DURE UPS-KAART?
        </h2>
        <p className="text-zinc-300 text-sm md:text-base max-w-3xl">
          Een vendor-specifieke SNMP-kaart beschermt één UPS en één stack. Met
          PowerGuardian orkestreer je meerdere UPS’en, merken en locaties in één
          systeem. Shutdown-sequenties, VLAN-segmentatie en credential-beheer
          zijn gecentraliseerd, maar je blijft volledig eigenaar van je data.
        </p>
        <div className="grid gap-3 md:grid-cols-3 text-xs text-zinc-400">
          <CompareItem
            title="Multi-vendor"
            body="Eaton, APC en generieke HID-UPS: allemaal in één dashboard, één rules engine."
          />
          <CompareItem
            title="Infra-aware"
            body="Koppel UPS-en aan hosts, clusters en VLAN’s in plaats van alleen IP-adressen."
          />
          <CompareItem
            title="Future-proof"
            body="Connector OS images, OTA en R2 downloads maken upgrades beheersbaar."
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
            Vanaf dag één gericht op real-world datacenters & homelabs.
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            title="UPS autodiscovery"
            text="Scan USB, SNMP en NMC-kaarten, detecteer model, runtime, batterystatus en capabilities zonder handmatig driver-zoekwerk."
          />
          <FeatureCard
            title="Rules & shutdown mapping"
            text="Koppel UPS’en aan hosts en services. Definieer wie als eerste uit gaat, en wie pas vlak voor het einde."
          />
          <FeatureCard
            title="VLAN-aware networking"
            text="Gebruik de dual-NIC controller (bijv. NanoPi R3S) als dedicated management-node voor je power-plane."
          />
          <FeatureCard
            title="Credential vault"
            text="Versleutelde opslag voor SNMP-communities, SSH-users en API-tokens. Nooit meer wachtwoorden in losse config files."
          />
          <FeatureCard
            title="R2-powered downloads"
            text="Connector images, OS-updates en tools worden via Cloudflare R2 en CDN geserveerd voor snelle, globale roll-outs."
          />
          <FeatureCard
            title="OTA for Connectors"
            text="Plan connector-updates via de Controller, met signed packages en anti-cloning checks per node."
          />
        </div>
      </section>

      {/* CTA / NEXT STEPS */}
      <section className="pg-card p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Klaar om je UPS-landschap op te ruimen?
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl">
            Start met één Controller en één Connector naast je eerste UPS. Breid
            langzaam uit. PowerGuardian schaalt met je mee, of je nu een
            homelab, een MKB-rack of een volledig datacenter beheert.
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
            Bekijk network & VLAN design
          </a>
        </div>
      </section>
    </div>
  );
}

/* ------- Kleine helper componenten ------- */

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
