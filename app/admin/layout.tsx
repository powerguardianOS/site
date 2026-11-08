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
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-28 pt-5 md:flex-row md:gap-8 md:px-6 md:pb-12 md:pt-8">
      <aside className="shrink-0 md:w-52">
        <div className="flex items-center justify-between gap-2 md:mb-5 md:block md:px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">PG Cloud admin</span>
          </div>
          <span className="max-w-[55%] truncate text-xs text-zinc-500 md:hidden">{email}</span>
        </div>
        <AdminNav />
        <div className="mt-6 hidden border-t border-zinc-800 px-2 pt-4 text-xs text-zinc-500 md:block">
          Signed in as<br />
          <span className="break-all text-zinc-300">{email}</span>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
