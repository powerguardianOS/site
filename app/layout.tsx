// app/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import MobileNav from "./components/MobileNav";
import { NAV_LINKS } from "./lib/nav";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://powerguardian.cloud"),
  title: {
    default: "PowerGuardian — Self-Hosted UPS Orchestration Platform",
    template: "%s · PowerGuardian",
  },
  description:
    "PowerGuardian is a self-hosted orchestration platform for UPS and power infrastructure. One control plane, zero vendor lock-in.",
  keywords: [
    "UPS orchestration",
    "self-hosted UPS monitoring",
    "power infrastructure",
    "uninterruptible power supply",
    "NUT UPS",
    "power management",
    "datacenter UPS",
    "server power monitoring",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  authors: [{ name: "PowerGuardian" }],
  creator: "PowerGuardian",
  openGraph: {
    type: "website",
    siteName: "PowerGuardian",
    title: "PowerGuardian — Self-Hosted UPS Orchestration Platform",
    description: "Self-hosted orchestration platform for UPS and power infrastructure. One control plane, zero vendor lock-in.",
    url: "https://powerguardian.cloud",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PowerGuardian — Self-Hosted UPS Orchestration Platform",
    description: "Self-hosted orchestration platform for UPS and power infrastructure. One control plane, zero vendor lock-in.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/favicon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group relative text-sm text-zinc-400 hover:text-white transition-colors"
    >
      {label}
      <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[#00C66F] transition-all duration-200 group-hover:w-full" />
    </Link>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={ibmPlexSans.variable}>
      <body className="bg-[#060a14] text-[#f0f4ff] antialiased">
        <MobileNav />

        <div className="min-h-screen flex flex-col">
          {/* DESKTOP HEADER */}
          <header className="hidden lg:block sticky top-0 z-50 border-b border-white/[0.06] bg-[#060a14]/85 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,198,111,0.08)]">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 lg:px-6">
              {/* Brand */}
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00C66F]/20 to-[#00C66F]/5 border border-[#00C66F]/20 hover:border-[#00C66F]/35 transition-all">
                  <Image src="/logo.svg" alt="PowerGuardian logo" width={22} height={22} priority />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight text-white">PowerGuardian</span>
                  <span className="hidden lg:block text-[10px] uppercase tracking-[0.22em] text-[#00C66F]/55">
                    UPS orchestration
                  </span>
                </div>
              </Link>

              {/* Nav links */}
              <nav className="flex items-center gap-6">
                {NAV_LINKS.map((l) => <NavLink key={l.href} href={l.href} label={l.label} />)}
              </nav>

              <div className="flex items-center gap-3">
                <Link
                  href="/pricing"
                  className="px-4 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-sm font-medium hover:border-zinc-600 hover:text-zinc-300 transition-all"
                >
                  Pricing
                </Link>
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          {/* FOOTER */}
          <footer className="border-t border-white/[0.05] bg-[#040810]/80">
            <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-zinc-600">
              <span>© {new Date().getFullYear()} PowerGuardian</span>
              <nav className="flex items-center gap-4">
                <Link href="/pricing" className="hover:text-zinc-400 transition-colors">Pricing</Link>
                <Link href="/roadmap" className="hover:text-zinc-400 transition-colors">Roadmap</Link>
              </nav>
              <span className="text-[11px] text-zinc-700">
                Self-hosted UPS &amp; power orchestration · no vendor lock-in
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
