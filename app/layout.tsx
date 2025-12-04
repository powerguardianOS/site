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
    "PowerGuardian is a zero-touch control plane for UPS and power orchestration. One dashboard, no vendor lock-in, with VLAN-aware networking and OTA updates.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-64.png", type: "image/png", sizes: "64x64" },
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
      <body className="bg-[#05070B] text-white antialiased">
        <div className="min-h-screen flex flex-col">
          {/* Top navigation */}
          <header className="border-b border-zinc-900/80 bg-[#05070B]/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 md:px-6">
              {/* Brand */}
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C66F]/10">
                  <Image
                    src="/logo.svg"
                    alt="PowerGuardian logo"
                    width={26}
                    height={26}
                    priority
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight">
                    PowerGuardian
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                    Connector &amp; Controller OS
                  </span>
                </div>
              </Link>

              {/* Nav items */}
              <nav className="flex items-center gap-5">
                <NavLink href="/" label="Overview" />
                <NavLink href="/connector" label="Connector OS" />
                <NavLink href="/controller" label="Controller OS" />
                <NavLink href="/downloads" label="Downloads" />
              </nav>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
              {children}
            </div>
          </main>

          {/* Footer (simple for now) */}
          <footer className="border-t border-zinc-900/80 bg-[#05070B]">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 text-xs text-zinc-500 md:px-6">
              <span>© {new Date().getFullYear()} PowerGuardian</span>
              <span className="text-[11px]">
                Self-hosted UPS orchestration · no vendor lock-in
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
