export const runtime = 'edge';

import { adminGuard, getAdminEmail } from '@/app/lib/admin';
import { logAudit } from '@/app/lib/audit';

import { getLicenses, updateLicense } from '@/app/lib/license-db';
import { deleteAddon, deleteSite } from '@/app/lib/addons';
import type { LicenseRecord } from '@/app/lib/license-db';

const PLANS: LicenseRecord['plan'][] = ['home', 'pro', 'founder', 'addon_connector'];

// Licenses are never hard-deleted from here: "revoke" (status change) keeps the
// record and its audit trail, and is reversible. PATCH is a strict whitelist —
// token, email, id and created_at can never be changed through this route.
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'invalid JSON' }, { status: 400 });

  const patch: Partial<LicenseRecord> = {};

  if ('plan' in body) {
    if (!PLANS.includes(body.plan as LicenseRecord['plan'])) return Response.json({ error: 'invalid plan' }, { status: 400 });
    patch.plan = body.plan as LicenseRecord['plan'];
  }
  if ('connector_limit' in body) {
    const n = Number(body.connector_limit);
    if (!Number.isInteger(n) || n < 0 || n > 10000) return Response.json({ error: 'invalid connector_limit' }, { status: 400 });
    patch.connector_limit = n;
  }
  if ('expires_at' in body) {
    if (body.expires_at === null || body.expires_at === '') {
      patch.expires_at = null;
    } else {
      const d = new Date(String(body.expires_at));
      if (isNaN(d.getTime())) return Response.json({ error: 'invalid expires_at' }, { status: 400 });
      patch.expires_at = d.toISOString();
    }
  }
  if ('status' in body) {
    if (body.status !== 'active' && body.status !== 'revoked') {
      return Response.json({ error: 'status must be active or revoked' }, { status: 400 });
    }
    patch.status = body.status;
  }
  if ('site_name' in body) {
    const n = typeof body.site_name === 'string' ? body.site_name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) : '';
    if (!n) return Response.json({ error: 'site_name must not be empty' }, { status: 400 });
    patch.site_name = n;
  }
  if ('offline_allowed' in body) {
    if (typeof body.offline_allowed !== 'boolean') return Response.json({ error: 'offline_allowed must be true or false' }, { status: 400 });
    patch.offline_allowed = body.offline_allowed;
  }
  if ('notes' in body) {
    if (typeof body.notes !== 'string') return Response.json({ error: 'invalid notes' }, { status: 400 });
    patch.notes = body.notes.slice(0, 2000);
  }

  if (Object.keys(patch).length === 0) return Response.json({ error: 'nothing to update' }, { status: 400 });

  const existing = (await getLicenses()).find(l => l.id === id);
  if (!existing) return Response.json({ error: 'license not found' }, { status: 404 });

  const updated = await updateLicense(id, patch);
  if (!updated) return Response.json({ error: 'license not found' }, { status: 404 });
  const { notes: _n, ...shown } = patch;
  await logAudit({ actor: (await getAdminEmail()) ?? 'admin', role: 'admin', action: patch.status ? `license.${patch.status === 'revoked' ? 'revoke' : 'reactivate'}` : 'license.update', email: updated.email, license_id: id, detail: JSON.stringify(shown) });
  return Response.json({ license: updated });
}

// Deletes a connector add-on, or a whole site (its license, add-ons and status).
// Both refuse while the connectors / license are still in use (lib/addons.ts).
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null) as { confirm?: unknown } | null;
  const lic = (await getLicenses()).find((l) => l.id === id);
  const r = lic?.plan === 'addon_connector' ? await deleteAddon(id) : await deleteSite(id, body?.confirm);
  if (!r.ok) return Response.json({ error: r.error, message: r.message }, { status: r.status });
  await logAudit({ actor: (await getAdminEmail()) ?? 'admin', role: 'admin', action: lic?.plan === 'addon_connector' ? 'addon.delete' : 'site.delete', email: lic?.email, license_id: id, detail: lic?.site_name ?? undefined });
  return Response.json({ deleted: true });
}
