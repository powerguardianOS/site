export const runtime = 'edge';

import { adminGuard, getAdminEmail } from '@/app/lib/admin';
import { releaseSite } from '@/app/lib/site-actions';

// Frees a site for another controller (for instance after a hardware swap).
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const r = await releaseSite(id, { email: (await getAdminEmail()) ?? 'admin', role: 'admin' });
  return r.ok ? Response.json({ released: true }) : Response.json({ error: r.error, message: r.message }, { status: r.status });
}
