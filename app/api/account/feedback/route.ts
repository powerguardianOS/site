export const runtime = 'edge';

import { ownerGuard } from '@/app/lib/owner';
import { listOwn, submitFeedback } from '@/app/lib/feedback';

// FEEDBACK-1 on /account and /feedback (app/lib/feedback.ts).
//   POST {kind, text, version?} → {id}      GET → {items}
// Signed-in owner only; POST needs JSON + same origin (ownerGuard). Always the session's own account.
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const r = await submitFeedback(request, { email: who.email, source: 'web', bucket: `feedback:acct:${who.email}` });
  return json(r.body, r.status);
}

export async function GET(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  return json({ items: await listOwn(who.email) });
}
