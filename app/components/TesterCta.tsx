import Link from 'next/link';

// Tester waitlist call to action (home page and pricing page): calm, one card, short.
export default function TesterCta({ className = '' }: { className?: string }) {
  return (
    <section data-cta="tester" aria-labelledby="tester-cta-title"
      className={`rounded-2xl border border-[#00C66F]/20 bg-gradient-to-b from-[#00C66F]/[0.04] to-transparent p-6 md:p-8 ${className}`}>
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#00C66F]/70 font-mono">Beta</div>
          <h2 id="tester-cta-title" className="pg-display text-3xl md:text-4xl text-white">
            Become a tester <em className="text-zinc-400">— free during the beta</em>
          </h2>
          <p className="text-sm text-zinc-400">Join the waitlist. We invite in small groups.</p>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-zinc-500 text-xs mb-1.5">You get</div>
              <ul className="space-y-1 text-zinc-300">
                <li>PowerGuardian Pro, free during the beta</li>
                <li>A direct line to the maker</li>
              </ul>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1.5">We ask</div>
              <ul className="space-y-1 text-zinc-300">
                <li>Install it on your own hardware</li>
                <li>Tell us your UPS and devices</li>
                <li>Give honest feedback</li>
              </ul>
            </div>
          </div>
        </div>
        <Link href="/tester" className="pg-btn-primary shrink-0 rounded-lg px-6 py-3 text-center font-semibold">
          Join the waitlist
        </Link>
      </div>
    </section>
  );
}
