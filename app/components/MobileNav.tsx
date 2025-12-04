"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* TOP BAR (mobile only) */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-black/90 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-sm bg-[#00C66F]" />
          <span className="text-white font-semibold tracking-tight">
            PowerGuardian
          </span>
        </div>

        {/* MENU BUTTON */}
        <button
          onClick={() => setOpen(true)}
          className="text-white p-2 hover:text-[#00C66F] transition"
        >
          <Menu size={26} />
        </button>
      </div>

      {/* OVERLAY */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* SLIDE-IN MENU */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-[#0E0E0E] border-l border-zinc-800 z-50 transform transition-transform duration-300 lg:hidden ${
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

          <button
            onClick={() => setOpen(false)}
            className="text-white hover:text-[#00C66F] transition"
          >
            <X size={26} />
          </button>
        </div>

        {/* NAV LINKS */}
        <nav className="flex flex-col p-6 space-y-4 text-lg">
          <Link
            href="/"
            className="text-zinc-300 hover:text-[#00C66F] transition"
            onClick={() => setOpen(false)}
          >
            Dashboard
          </Link>

          <Link
            href="/controller"
            className="text-zinc-300 hover:text-[#00C66F] transition"
            onClick={() => setOpen(false)}
          >
            Controller OS
          </Link>

          <Link
            href="/connector"
            className="text-zinc-300 hover:text-[#00C66F] transition"
            onClick={() => setOpen(false)}
          >
            Connector OS
          </Link>

          <Link
            href="/docs"
            className="text-zinc-300 hover:text-[#00C66F] transition"
            onClick={() => setOpen(false)}
          >
            Documentation
          </Link>

          <Link
            href="/download"
            className="text-zinc-300 hover:text-[#00C66F] transition"
            onClick={() => setOpen(false)}
          >
            Downloads
          </Link>
        </nav>
      </div>
    </>
  );
}
