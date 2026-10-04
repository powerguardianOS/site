export const runtime = 'edge';

import { adminGuard, getAdminEmail } from '@/app/lib/admin';
import { logAudit } from '@/app/lib/audit';

import { regenToken } from '@/app/lib/license-db';

// Replaces the license's long-lived token. The old token stops working at once
// (license verify + relay), so the customer's controller must be re-linked.
// The new token is deliberately NOT returned: it is never shown to anyone, the
// controller receives it through the normal email-code link flow.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { id } = await ctx.params;

  const record = await regenToken(id);
  if (!record) return Response.json({ error: 'license not found' }, { status: 404 });
  await logAudit({ actor: (await getAdminEmail()) ?? 'admin', role: 'admin', action: 'token.rotate', email: record.email, license_id: id });
  return Response.json({ rotated: true });
}
