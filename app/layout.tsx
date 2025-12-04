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
    <div className="h-10 w-10">
      <svg
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full drop-shadow-[0_0_12px_rgba(0,198,111,0.6)]"
      >
        {/* Schild-vorm */}
        <path
          d="M20 3 L31 7.5 C31.8 7.8 32.3 8.6 32.3 9.5 V20.5C32.3 26.9 27.9 32.7 21.6 34.3L20 34.7L18.4 34.3C12.1 32.7 7.7 26.9 7.7 20.5V9.5C7.7 8.6 8.2 7.8 9 7.5L20 3Z"
          fill="#00C66F"
        />
        {/* Power-symbool */}
        <g
          stroke="#0E0E0E"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Rechte lijn van power-knop */}
          <line x1="20" y1="11" x2="20" y2="18" />
          {/* Boog van power-knop */}
          <path d="M14.2 18.8C13.3 19.8 12.7 21.1 12.7 22.6C12.7 25.7 15.1 28.1 18.2 28.1H21.8C24.9 28.1 27.3 25.7 27.3 22.6C27.3 21.1 26.7 19.8 25.8 18.8" />
        </g>
      </svg>
    </div>
  );
}
