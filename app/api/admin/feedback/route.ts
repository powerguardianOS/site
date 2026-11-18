export const runtime = 'edge';

import { adminFromRequest, adminGuard } from '@/app/lib/admin';
import { logAudit } from '@/app/lib/audit';
import { applyAdminAction, parseAdminAction } from '@/app/lib/feedback';

// FEEDBACK-1 admin actions from /admin/feedback: POST {id, action: reply|merge|seen|plan|reject|fixed, text?, into?,
// fixed_in?}. Admin session + JSON + same origin (adminGuard), and every change is in the audit log.
export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const admin = (await adminFromRequest(request))!;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = parseAdminAction(body);
  if (!action || typeof body?.id !== 'string') return Response.json({ error: 'invalid' }, { status: 400 });
  const r = await applyAdminAction(body.id, action);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  const detail = action.action === 'merge' ? `${body.id} into ${r.item.merged_into}` : action.action === 'fixed' && action.fixed_in ? `${r.item.id} in ${action.fixed_in}` : r.item.id;
  await logAudit({ actor: admin, role: 'admin', action: `feedback.${action.action}`, email: r.item.email, detail });
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
