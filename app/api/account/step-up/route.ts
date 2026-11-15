export const runtime = 'edge';

// B2 (review): the fresh confirmation before adding a second step (app/lib/step-up.ts). Signed-in owner, JSON + same
// origin (ownerGuard); always the session's own account.
//   POST { action: 'start' }                  → { need: 'second', passkey, totp } | { need: 'email', to }  (mails a code)
//   POST { action: 'verify', code | credential } → { ok: true }   this session may add a passkey / the app (10 minutes)
// A passkey confirmation takes its challenge from POST /api/account/passkeys { action: 'confirm-options' }.
import { ownerGuard } from '@/app/lib/owner';
import { startStepUp, verifyStepUp } from '@/app/lib/step-up';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const body = (await request.json().catch(() => null)) as { action?: unknown; code?: unknown; credential?: unknown } | null;
  if (body?.action === 'start') { const r = await startStepUp(who.email); return json(r.body, r.status); }
  if (body?.action === 'verify') {
    const r = await verifyStepUp(who.email, who.sessionId, body);
    return r.ok ? json({ ok: true }) : json({ error: r.error, message: r.message }, r.status);
  }
  return json({ error: 'unknown_action' }, 400);
}
