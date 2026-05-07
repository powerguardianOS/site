import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/app/content/faq";

export const metadata: Metadata = {
  title: "FAQ · PowerGuardian",
  description: "Frequently asked questions about PowerGuardian — controller, connector, and cloud licensing.",
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12 space-y-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Frequently Asked Questions</h1>
        <p className="text-zinc-400">Everything you need to know about PowerGuardian.</p>
      </div>

      {FAQ.map((section) => (
        <div key={section.title}>
          <h2 className="text-lg font-semibold text-[#00C66F] mb-4">{section.title}</h2>
          <div className="divide-y divide-zinc-800">
            {section.items.map((item) => (
              <div key={item.q} className="py-5">
                <p className="font-medium text-white">{item.q}</p>
                <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <p className="font-medium">Still have questions?</p>
          <p className="text-sm text-zinc-400 mt-1">Check the docs or send us an email.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/docs" className="text-sm px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors">
            Read the docs
          </Link>
          <a href="mailto:support@powerguardian.cloud" className="text-sm px-4 py-2 rounded-lg bg-[#00C66F] text-black font-medium hover:bg-[#00b564] transition-colors">
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
