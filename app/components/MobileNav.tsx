"use client";

import { useState } from "react";
import Link from "next/link";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* MOBILE TOP BAR */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#020617]/95 backdrop-blur">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-sm bg-[#00C66F]" />
          <span className="text-white font-semibold tracking-tight">
            PowerGuardian
          </span>
        </div>

        {/* HAMBURGER BUTTON */}
        <button
          onClick={() => setOpen(true)}
          className="text-white p-2 hover:text-[#00C66F] transition"
        >
          <span className="block w-6 h-[2px] bg-white mb-1 rounded" />
          <span className="block w-6 h-[2px] bg-white mb-1 rounded" />
          <span className="block w-6 h-[2px] bg-white rounded" />
        </button>
      </div>

      {/* OVERLAY */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* SLIDE-IN MENU */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-[#0E0E0E] border-l border-zinc-800 z-50 transform transition-transform duration-300 md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-sm bg-[#00C66F]" />
            <span className="text-white font-semibold tracking-tight">
              Menu
            </span>
          </div>

          {/* CLOSE BUTTON (X) */}
          <button
            onClick={() => setOpen(false)}
            className="text-white hover:text-[#00C66F] transition relative w-6 h-6"
          >
            <span className="absolute inset-0 w-[2px] h-6 bg-white rotate-45 origin-center rounded" />
            <span className="absolute inset-0 w-[2px] h-6 bg-white -rotate-45 origin-center rounded" />
          </button>
        </div>

        {/* NAV LINKS */}
        <nav className="flex flex-col p-6 space-y-4 text-lg">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="text-zinc-300 hover:text-[#00C66F] transition"
          >
            Overview
          </Link>

          <Link
            href="/connector"
            onClick={() => setOpen(false)}
            className="text-zinc-300 hover:text-[#00C66F] transition"
          >
            Connector OS
          </Link>

          <Link
            href="/controller"
            onClick={() => setOpen(false)}
            className="text-zinc-300 hover:text-[#00C66F] transition"
          >
            Controller OS
          </Link>

          <Link
            href="/downloads"
            onClick={() => setOpen(false)}
            className="text-zinc-300 hover:text-[#00C66F] transition"
          >
            Downloads
          </Link>

          <Link
            href="/roadmap"
            onClick={() => setOpen(false)}
            className="text-zinc-300 hover:text-[#00C66F] transition"
          >
            Roadmap
          </Link>
        </nav>
      </div>
    </>
  );
}
