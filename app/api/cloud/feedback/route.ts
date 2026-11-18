export const runtime = 'edge';

import { getLicenseByToken } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { withRoot } from '@/app/lib/founder';
import { decideHeartbeat } from '@/app/lib/sitelink';
import { listOwn, submitFeedback } from '@/app/lib/feedback';

// FEEDBACK-1, the controller's Settings → Feedback (app/lib/feedback.ts).
//   POST {kind, text, version, report_id?} → {id}      GET → {items}
// Authenticated like /api/cloud/heartbeat: the license token as Bearer. The license decides the account (its owner's
// e-mail); nothing in the request can name another one. A revoked, expired or retired license is refused.
async function caller(request: Request): Promise<LicenseRecord | Response> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const found = token ? await getLicenseByToken(token) : null;
  const license = found && await withRoot(found);
  if (!license) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const raw = request.headers.get('x-controller-id') ?? '';
  const d = decideHeartbeat(license, token, /^[0-9a-f]{32,64}$/i.test(raw) ? raw.toLowerCase() : undefined, Math.floor(Date.now() / 1000));
  if (d.kind === 'denied') return Response.json({ error: d.error }, { status: d.status });
  return license;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const l = await caller(request);
  if (l instanceof Response) return l;
  const r = await submitFeedback(request, { email: l.email, source: 'controller', license_id: l.id, bucket: `feedback:lic:${l.id}` });
  return json(r.body, r.status);
}

export async function GET(request: Request) {
  const l = await caller(request);
  if (l instanceof Response) return l;
  return json({ items: await listOwn(l.email) });
}
