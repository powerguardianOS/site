export const runtime = 'edge';

// PASSKEYS-1: POST { handle? } (signed-in owner) → { handle, masked, passkey } for this browser's remembered-account
// card on /login (app/lib/remember.ts). Called by the account page after each sign-in.
import { ownerGuard } from '@/app/lib/owner';
import { rememberHandle } from '@/app/lib/remember';
import { passkeyCount } from '@/app/lib/passkeys';
import { maskEmail } from '@/app/lib/magic-link';

export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const body = (await request.json().catch(() => null)) as { handle?: unknown } | null;
  const [handle, n] = await Promise.all([rememberHandle(who.email, body?.handle), passkeyCount(who.email)]);
  return Response.json({ handle, masked: maskEmail(who.email), passkey: n > 0 }, { headers: { 'Cache-Control': 'no-store' } });
}
