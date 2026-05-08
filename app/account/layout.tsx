export const runtime = 'edge';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/app/lib/session';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pg_session')?.value;
  if (!sessionId) {
    redirect('/login');
  }
  const email = await getSession(sessionId);
  if (!email) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12 space-y-6">
      {/* Account sub-header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00C66F]" />
          <span>{email}</span>
        </div>
        <Link href="/api/auth/logout" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          Sign out
        </Link>
      </div>

      {children}
    </div>
  );
}
