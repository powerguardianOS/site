// app/downloads/page.tsx
export default function DownloadsPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Downloads</h1>
        <p className="text-sm md:text-base text-zinc-400 max-w-2xl">
          Connector OS and Controller OS images will be distributed via
          Cloudflare R2 and global CDN. For now, this page acts as the hub
          where you publish stable and experimental builds.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Connector OS images
          </h2>
          <p className="text-sm text-zinc-400">
            Edge images for devices sitting next to your UPS.
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>• NanoPi Neo3 (primary reference)</li>
            <li>• Raspberry Pi (future)</li>
          </ul>
          <div className="mt-3 text-xs text-zinc-500">
            When R2 endpoints are ready, list direct download links here along
            with checksums.
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Controller OS images
          </h2>
          <p className="text-sm text-zinc-400">
            Central management images for racks, homelabs and small DCs.
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>• NanoPi R3S</li>
            <li>• x86 VM / bare metal (future)</li>
            <li>• Docker / container image (future)</li>
          </ul>
          <div className="mt-3 text-xs text-zinc-500">
            Add stable and testing builds, plus release notes, once available.
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Checksums &amp; verification</h2>
        <p className="text-sm text-zinc-400 max-w-3xl">
          For a production-grade setup, every image should ship with SHA256
          checksums and, over time, signed manifests. That way you can verify
          that what you downloaded is exactly what was published.
        </p>
      </section>
    </div>
  );
}
