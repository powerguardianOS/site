// app/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PowerGuardian",
    template: "%s · PowerGuardian",
  },
  description:
    "PowerGuardian is a self-hosted orchestration platform for UPS and power infrastructure. One control plane, zero vendor lock-in.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      {
        url: "/favicon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

function NavLink(props: { href: string; label: string }) {
  return (
    <Link
      href={props.href}
      className="text-sm text-zinc-400 hover:text-white transition-colors"
    >
      {props.label}
    </Link>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#020617] text-white antialiased">
        <div className="min-h-screen flex flex-col">
          {/* Top navigation */}
          <header className="border-b border-zinc-900/80 bg-[#020617]/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 md:px-6">
              {/* Brand */}
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C66F]/10">
                  <Image
                    src="/logo.svg"
                    alt="PowerGuardian logo"
                    width={28}
                    height={28}
                    priority
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight">
                    PowerGuardian
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    UPS orchestration platform
                  </span>
                </div>
              </Link>

              {/* Nav */}
              <nav className="hidden md:flex items-center gap-6">
                <NavLink href="/" label="Overview" />
                <NavLink href="/connector" label="Connector OS" />
                <NavLink href="/controller" label="Controller OS" />
                <NavLink href="/downloads" label="Downloads" />
                <NavLink href="/roadmap" label="Roadmap" />
              </nav>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14 space-y-16">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-zinc-900/80 bg-black/60">
            <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-zinc-500">
              <span>© {new Date().getFullYear()} PowerGuardian</span>
              <span className="text-[11px]">
                Self-hosted UPS &amp; power orchestration · no vendor lock-in
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
