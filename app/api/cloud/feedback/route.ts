export const runtime = 'edge';

import { holderCaller } from '@/app/lib/controller-auth';
import { listOwn, submitFeedback } from '@/app/lib/feedback';

// FEEDBACK-1, the controller's Settings → Feedback (app/lib/feedback.ts).
//   POST {kind, text, version, report_id?} → {id}      GET → {items}
// Only the holder of a site (holderCaller: license token as Bearer, hardware ID in X-Controller-Id, like the site
// switcher): a copy or a retired controller is refused, as is a revoked or expired license. The license decides the
// account (its owner's e-mail); nothing in the request can name another one.
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const l = await holderCaller(request);
  if (l instanceof Response) return l;
  const r = await submitFeedback(request, { email: l.email, source: 'controller', license_id: l.id, bucket: `feedback:lic:${l.id}` });
  return json(r.body, r.status);
}

export async function GET(request: Request) {
  const l = await holderCaller(request);
  if (l instanceof Response) return l;
  return json({ items: await listOwn(l.email) });
}
