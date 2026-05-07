import type { Metadata } from "next";
import Link from "next/link";
import { DOCS } from "@/app/content/docs";

export const metadata: Metadata = {
  title: "Documentation · PowerGuardian",
  description: "PowerGuardian technical documentation — controller, connector OS, and cloud portal.",
};

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <div className="md:grid md:grid-cols-[200px_1fr] gap-12">

        {/* Sidebar */}
        <aside className="hidden md:block">
          <div className="sticky top-8 space-y-1">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Contents</p>
            {DOCS.map((doc) => (
              <a key={doc.slug} href={`#${doc.slug}`} className="block text-sm text-zinc-400 hover:text-white py-1 transition-colors">
                {doc.title}
              </a>
            ))}
            <div className="pt-4 border-t border-zinc-800 mt-4">
              <Link href="/faq" className="block text-sm text-zinc-400 hover:text-white py-1 transition-colors">FAQ →</Link>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="space-y-16">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
            <p className="text-zinc-400">Technical reference for all PowerGuardian components.</p>
          </div>

          {DOCS.map((doc) => (
            <section key={doc.slug} id={doc.slug} className="space-y-6 scroll-mt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">{doc.title}</h2>
                <p className="text-zinc-400 leading-relaxed">{doc.intro}</p>
              </div>

              {doc.sections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-sm font-semibold text-[#00C66F] uppercase tracking-wider mb-3">{section.title}</h3>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
                    <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{section.body}</p>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
