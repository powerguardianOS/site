export const runtime = 'edge';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import AdminNav from './AdminNav';

// Stopgap until CF-1 (Cloudflare Access + Google SSO) is deployed — this
// route was previously reachable by anyone, with no auth check at all,
// rendering every account and license on the platform. ADMIN_EMAIL matches
// the env var name already planned for CF-1, so the two layers agree once
// Access is set up rather than conflict.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pg_session')?.value;
  if (!sessionId) redirect('/login');

  const email = await getSession(sessionId);
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!email || !adminEmail || email.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect('/login');
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row md:px-6">
      <aside className="shrink-0 md:w-56">
        <div className="mb-3 flex items-center gap-2 px-2 md:mb-5">
          <span className="text-sm font-semibold text-white">Admin</span>
          <span className="rounded border border-zinc-800 px-1.5 text-[10px] text-zinc-500">global</span>
        </div>
        <AdminNav />
        <div className="mt-6 hidden border-t border-zinc-800 px-2 pt-4 text-xs text-zinc-500 md:block">
          Signed in as<br />
          <span className="text-zinc-300">{email}</span>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
