export const runtime = 'edge';

import { isReconfirmed, ownerGuard } from '@/app/lib/owner';
import { issueOfflineLease, keepCopy, releaseSite, removeCopy, replaceWithCopy } from '@/app/lib/site-actions';

// Everything here changes which controller may run a site, so each action needs the
// session AND a recent e-mail confirmation. Every one is audited and mailed (see lib).
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  if (!(await isReconfirmed(who.sessionId))) {
    return Response.json({ error: 'reconfirm_required', message: 'Confirm with the code we e-mail you.' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null) as { action?: unknown; controller_id?: unknown } | null;
  const actor = { email: who.email, role: 'owner' as const };

  const r =
    body?.action === 'replace' ? await replaceWithCopy(id, body.controller_id, actor)
    : body?.action === 'keep' ? await keepCopy(id, body.controller_id, actor)
    : body?.action === 'remove' ? await removeCopy(id, body.controller_id, actor)
    : body?.action === 'release' ? await releaseSite(id, actor)
    : body?.action === 'offline_lease' ? await issueOfflineLease(id, body.controller_id, actor)
    : null;
  if (!r) return Response.json({ error: 'unknown_action' }, { status: 400 });
  return r.ok ? Response.json(r.value) : Response.json({ error: r.error, message: r.message }, { status: r.status });
}
