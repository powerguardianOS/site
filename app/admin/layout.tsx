export const runtime = 'edge';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';

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

  return <>{children}</>;
}
