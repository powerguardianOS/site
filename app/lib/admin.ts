import { cookies } from 'next/headers';
import { getSession } from '@/app/lib/session';

// The one admin rule: a live session whose e-mail is exactly ADMIN_EMAIL. Returns the admin's email, or null.
async function adminOfSession(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) return null;
  const email = await getSession(sessionId);
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!email || !adminEmail || email.toLowerCase() !== adminEmail.toLowerCase()) {
    return null;
  }
  return email;
}

// Route handlers are not covered by app/admin/layout.tsx, so every /api/admin
// handler must call this itself. Returns the admin's email, or null.
export async function getAdminEmail(): Promise<string | null> {
  return adminOfSession((await cookies()).get('pg_session')?.value);
}

// Full guard for /api/admin handlers: admin session, plus — for anything that
// changes state — a JSON content-type and a same-origin Origin header, so a
// cross-site form post can never ride on the admin's cookie.
// Returns an error Response to send back, or null when the request may proceed.
export async function adminGuard(request: Request): Promise<Response | null> {
  if (!(await adminFromRequest(request))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const ct = request.headers.get('content-type') ?? '';
    if (!ct.toLowerCase().startsWith('application/json')) {
      return Response.json({ error: 'application/json required' }, { status: 415 });
    }
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).host !== new URL(request.url).host) {
      return Response.json({ error: 'cross-origin request refused' }, { status: 403 });
    }
  }
  return null;
}

// The same admin check, read from the request's own Cookie header (for handlers that are also unit tested
// outside Next, where next/headers has no request).
export async function adminFromRequest(request: Request): Promise<string | null> {
  const sid = (request.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith('pg_session='))?.slice('pg_session='.length);
  let id: string | undefined;
  try { id = sid ? decodeURIComponent(sid) : undefined; } catch { return null; } // a malformed cookie: not signed in
  return adminOfSession(id);
}
