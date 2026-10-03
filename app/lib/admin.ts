import { cookies } from 'next/headers';
import { getSession } from '@/app/lib/session';

// Route handlers are not covered by app/admin/layout.tsx, so every /api/admin
// handler must call this itself. Returns the admin's email, or null.
export async function getAdminEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pg_session')?.value;
  if (!sessionId) return null;

  const email = await getSession(sessionId);
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!email || !adminEmail || email.toLowerCase() !== adminEmail.toLowerCase()) {
    return null;
  }
  return email;
}
