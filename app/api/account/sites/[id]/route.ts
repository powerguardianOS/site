export const runtime = 'edge';

import { ownerGuard } from '@/app/lib/owner';
import { renameSite } from '@/app/lib/site-actions';

// Renaming is harmless and reversible, so it needs no extra confirmation.
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null) as { name?: unknown } | null;
  const r = await renameSite(id, body?.name, { email: who.email, role: 'owner' });
  return r.ok ? Response.json(r.value) : Response.json({ error: r.error, message: r.message }, { status: r.status });
}
