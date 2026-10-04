export const runtime = 'edge';

import { ownerGuard, sendReconfirmCode } from '@/app/lib/owner';
import { rateLimited } from '@/app/lib/ratelimit';

// Sends a 6-digit code to the account's own address, to confirm a sensitive action.
export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  if (await rateLimited(`reconfirm:${who.email}`, 5, 3600)) return Response.json({ error: 'rate_limited' }, { status: 429 });
  await sendReconfirmCode(who.email);
  return Response.json({ sent: true });
}
