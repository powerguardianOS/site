import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PowerGuardian",
  description: "Power orchestration for UPS & energy systems.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#0E0E0E]">
      <body className="bg-[#0E0E0E] text-white min-h-screen antialiased">
        <div className="flex min-h-screen flex-col">
          {/* TOP NAV */}
          <header className="border-b border-zinc-800 bg-black/40 backdrop-blur">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
              {/* Logo + title */}
              <a href="/" className="flex items-center gap-3">
                <ShieldLogo />
                <div className="leading-tight">
                  <div className="font-semibold tracking-tight">
                    PowerGuardian
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    CONNECTOR &amp; CONTROLLER OS
                  </div>
                </div>
              </a>

              {/* Menu */}
              <nav className="flex items-center gap-3 text-sm text-zinc-300">
                <NavLink href="/">Home</NavLink>
                <NavLink href="/connector">Connector OS</NavLink>
                <NavLink href="/controller">Controller OS</NavLink>
                <NavLink href="/network">Network / VLAN</NavLink>
                <NavLink href="/downloads">Downloads</NavLink>
              </nav>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="flex-1">
            <div className="max-w-6xl mx-auto px-4 py-10">{children}</div>
          </main>

          {/* FOOTER */}
          <footer className="border-t border-zinc-900 bg-black/60">
            <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
              <span>
                © {new Date().getFullYear()} PowerGuardian. All rights
                reserved.
              </span>
              <span className="flex gap-3">
                <span>Connector OS · Controller OS · R2 downloads</span>
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

/**
 * NAV LINK
 */
function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="px-3 py-1 rounded-full hover:bg-zinc-900/80 hover:text-white transition text-xs md:text-sm border border-transparent hover:border-[#00C66F]/60"
    >
      {children}
    </a>
  );
}

/**
 * POWERGUARDIAN SHIELD LOGO
 * Groen schild met wit power-symbool
 */
function ShieldLogo() {
  return (
    <img
      src="/logo.svg"
      alt="PowerGuardian Logo"
      className="h-8 w-8"
    />
  );
}
