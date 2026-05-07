import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const email = cookieStore.get('pg_session')?.value;

  if (!email) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white/50 hover:text-white text-sm transition-colors">
            ← powerguardian.cloud
          </Link>
          <span className="text-white/20">|</span>
          <span className="text-sm text-white/70">{email}</span>
        </div>
        <Link
          href="/api/auth/logout"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          Sign out
        </Link>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
