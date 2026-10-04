export const runtime = 'edge';

import { adminGuard, getAdminEmail } from '@/app/lib/admin';
import { logAudit } from '@/app/lib/audit';

import { deleteTenant } from '@/app/lib/tenant-admin';

// Deleting a customer is destructive and irreversible, so it needs the admin
// session, a same-origin JSON request AND the e-mail typed back as confirmation.
export async function DELETE(request: Request, ctx: { params: Promise<{ email: string }> }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { email } = await ctx.params;

  const body = await request.json().catch(() => null) as { confirm?: unknown } | null;
  const result = await deleteTenant(decodeURIComponent(email), body?.confirm, process.env.ADMIN_EMAIL);
  if (!result.ok) return Response.json({ error: result.error, message: result.message }, { status: result.status });
  await logAudit({ actor: (await getAdminEmail()) ?? 'admin', role: 'admin', action: 'tenant.delete', email: decodeURIComponent(email).toLowerCase(), detail: `${result.licenses} licenses removed` });
  return Response.json({ deleted: true, licenses_removed: result.licenses });
}
