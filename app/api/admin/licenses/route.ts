export const runtime = 'edge';

import { adminGuard, getAdminEmail } from '@/app/lib/admin';
import { logAudit } from '@/app/lib/audit';

import { createLicense, getLicenses } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { createAccount, getAccount } from '@/app/lib/accounts';
import { createAddon } from '@/app/lib/addons';

const PLANS: LicenseRecord['plan'][] = ['home', 'pro', 'founder'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  return Response.json({ licenses: await getLicenses() });
}

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null) as {
    email?: unknown; plan?: unknown; connector_limit?: unknown;
    expires_at?: unknown; notes?: unknown;
  } | null;
  if (!body) return Response.json({ error: 'invalid JSON' }, { status: 400 });

  // Connector add-on: a separate license for ONE existing site (its own term).
  if (body.plan === 'addon_connector') {
    let expires: string | null = null;
    if (body.expires_at) {
      const d = new Date(String(body.expires_at));
      if (isNaN(d.getTime())) return Response.json({ error: 'invalid expires_at' }, { status: 400 });
      expires = d.toISOString();
    }
    const r = await createAddon({
      parent_id: String((body as { parent_id?: unknown }).parent_id ?? ''),
      connectors: Number(body.connector_limit),
      expires_at: expires,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '',
    });
    if (!r.ok) return Response.json({ error: r.error, message: r.message }, { status: r.status });
    await logAudit({ actor: (await getAdminEmail()) ?? 'admin', role: 'admin', action: 'addon.create', email: r.value.email, license_id: r.value.id, detail: `+${r.value.connector_limit} connectors, ends ${r.value.expires_at ?? 'never'}` });
    return Response.json({ license: r.value }, { status: 201 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return Response.json({ error: 'valid email required' }, { status: 400 });

  const plan = body.plan as LicenseRecord['plan'];
  if (!PLANS.includes(plan)) return Response.json({ error: 'invalid plan' }, { status: 400 });

  const limit = Number(body.connector_limit);
  if (!Number.isInteger(limit) || limit < 0 || limit > 10000) {
    return Response.json({ error: 'connector_limit must be an integer 0-10000 (0 = unlimited)' }, { status: 400 });
  }

  let expires_at: string | null = null;
  if (body.expires_at) {
    const d = new Date(String(body.expires_at));
    if (isNaN(d.getTime())) return Response.json({ error: 'invalid expires_at' }, { status: 400 });
    expires_at = d.toISOString();
  }

  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '';

  if (!(await getAccount(email))) await createAccount(email);
  const license = await createLicense({
    email, plan, site_id: 'default-site', connector_limit: limit, expires_at, notes,
    ...(typeof (body as { site_name?: unknown }).site_name === 'string' && (body as { site_name: string }).site_name.trim() ? { site_name: (body as { site_name: string }).site_name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) } : {}),
  });
  await logAudit({ actor: (await getAdminEmail()) ?? 'admin', role: 'admin', action: 'license.create', email: license.email, license_id: license.id, detail: `${license.plan}, ${license.connector_limit === 0 ? 'unlimited' : license.connector_limit} connectors, ends ${license.expires_at ?? 'never'}${license.site_name ? `, “${license.site_name}”` : ''}` });
  return Response.json({ license }, { status: 201 });
}
