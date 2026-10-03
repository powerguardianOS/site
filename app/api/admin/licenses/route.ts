export const runtime = 'edge';

import { adminGuard } from '@/app/lib/admin';
import { createLicense, getLicenses } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { createAccount, getAccount } from '@/app/lib/accounts';

const PLANS: LicenseRecord['plan'][] = ['home', 'pro', 'founder', 'addon_connector'];
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
  });
  return Response.json({ license }, { status: 201 });
}
