// app/downloads/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Downloads" };

const downloads = [
  {
    name: "Connector OS",
    desc: "Edge agent — runs on any Linux machine next to your UPS.",
    version: "v0.4.0",
    platform: "Linux · ARM64 / x86_64",
    file: "powerguardian-connector-os-v0.4.0-linux.tar.gz",
    sha256: "coming soon",
    href: "#",
    badge: "Stable",
    badgeColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    name: "Connector OS — NanoPi R3S image",
    desc: "Ready-to-flash SD/eMMC image for NanoPi R3S hardware.",
    version: "v0.4.0",
    platform: "ARM64 · NanoPi R3S",
    file: "powerguardian-connector-os-v0.4.0-nanopi-r3s.img.gz",
    sha256: "coming soon",
    href: "#",
    badge: "Stable",
    badgeColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    name: "Connector OS — Windows",
    desc: "Pre-built Windows agent binary (tray app + console tool).",
    version: "v0.4.0",
    platform: "Windows · x86_64",
    file: "powerguardian-agent.exe",
    sha256: "coming soon",
    href: "#",
    badge: "Beta",
    badgeColor: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    name: "Controller OS",
    desc: "Central management plane — one appliance per site.",
    version: "v0.4.0",
    platform: "ARM64 · NanoPi R3S",
    file: "powerguardian-controller-os-v0.4.0-nanopi-r3s.img.gz",
    sha256: "coming soon",
    href: "#",
    badge: "Coming soon",
    badgeColor: "text-zinc-400 border-zinc-700 bg-zinc-800/40",
  },
];

export default function DownloadsPage() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Downloads</h1>
        <p className="text-zinc-400 max-w-2xl">
          Official builds for Connector OS and Controller OS. Verify checksums before flashing.
        </p>
      </div>

      <div className="space-y-4">
        {downloads.map((dl) => (
          <div
            key={dl.file}
            className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 flex flex-col md:flex-row md:items-center gap-4"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{dl.name}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${dl.badgeColor}`}>
                  {dl.badge}
                </span>
                <span className="text-xs text-zinc-500">{dl.version}</span>
              </div>
              <p className="text-xs text-zinc-400">{dl.desc}</p>
              <div className="flex flex-wrap gap-3 text-xs text-zinc-500 pt-1">
                <span>{dl.platform}</span>
                <span className="font-mono">SHA256: {dl.sha256}</span>
              </div>
            </div>

            <a
              href={dl.href}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition text-center ${
                dl.href === "#"
                  ? "border border-zinc-700 text-zinc-500 cursor-not-allowed"
                  : "bg-[#00C66F] text-black hover:bg-[#00b564] shadow-[var(--pg-cta-shadow)]"
              }`}
              aria-disabled={dl.href === "#"}
            >
              {dl.href === "#" ? "Not yet available" : `Download ${dl.file}`}
            </a>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Verify your download</h2>
        <p className="text-sm text-zinc-500">
          Check the SHA256 checksum before flashing any image:
        </p>
        <pre className="text-xs text-zinc-400 bg-black/40 rounded-lg p-3 overflow-x-auto">
          sha256sum powerguardian-connector-os-v0.4.0-linux.tar.gz
        </pre>
      </section>
    </div>
  );
}
