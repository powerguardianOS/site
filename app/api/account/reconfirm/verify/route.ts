export const runtime = 'edge';

import { ownerGuard, verifyReconfirmCode } from '@/app/lib/owner';

export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const ok = await verifyReconfirmCode(who.email, who.sessionId, body?.code);
  return ok ? Response.json({ confirmed: true }) : Response.json({ error: 'invalid_code', message: 'That code is wrong or has expired.' }, { status: 401 });
}
