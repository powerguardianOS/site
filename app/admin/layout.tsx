import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Admin · PowerGuardian' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#020617] text-zinc-100">
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="p-5 text-sm font-bold text-white tracking-tight border-b border-zinc-800">
          PowerGuardian <span className="text-[#00C66F]">Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <Link href="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white">
            Dashboard
          </Link>
          <Link href="/admin/licenses" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white">
            Licenses
          </Link>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-zinc-800 flex items-center px-6 shrink-0">
          <span className="text-sm text-zinc-400">admin.powerguardian.cloud</span>
        </header>
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
