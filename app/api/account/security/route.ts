export const runtime = 'edge';

// SESSIONS-1: "Sign-in & security" on the account page.
//   GET                                  → { sessions: SessionRow[], activity: ActivityRow[] }  (this account only)
//   POST { action: 'revoke', ref }       → { ok }   signs out one other session of this account
//   POST { action: 'revoke_others' }     → { ok, signed_out }   every session of this account except this one
// Signed-in owner only; POST needs JSON + same origin (ownerGuard). The account is always the session's own: nothing in
// the request can name another account, and a ref only counts when it is in this account's own session index.
import { ownerGuard } from '@/app/lib/owner';
import { listSessions, revokeSession, revokeOtherSessions, refOf } from '@/app/lib/session';
import { listActivity, logAudit } from '@/app/lib/audit';
import { sessionRows, activityRow } from '@/app/lib/security-view';
import { activityCtx, deviceLabel } from '@/app/lib/client-info';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const [sessions, activity] = await Promise.all([listSessions(who.email), listActivity(who.email)]);
  return json({ sessions: sessionRows(sessions, who.sessionH), activity: activity.map(activityRow) });
}

export async function POST(request: Request) {
  const who = await ownerGuard(request);
  if (who instanceof Response) return who;
  const body = (await request.json().catch(() => null)) as { action?: unknown; ref?: unknown } | null;
  const ctx = activityCtx(request);

  if (body?.action === 'revoke') {
    const ref = typeof body.ref === 'string' ? body.ref : '';
    if (who.sessionH && ref === refOf(who.sessionH)) return json({ error: 'this_device', message: 'Use Sign out at the top to sign out of this device.' }, 400);
    const ended = await revokeSession(who.email, ref);
    if (!ended) return json({ error: 'not_found', message: 'That session has already ended.' }, 404);
    await logAudit({ actor: who.email, role: 'owner', action: 'session.revoke', email: who.email, detail: ended.ua ? deviceLabel(ended.ua) : undefined, ...ctx });
    return json({ ok: true });
  }

  if (body?.action === 'revoke_others') {
    if (!who.sessionH) return json({ error: 'unavailable', message: 'Sign in again first.' }, 409);
    const n = await revokeOtherSessions(who.email, who.sessionH);
    if (n > 0) await logAudit({ actor: who.email, role: 'owner', action: 'session.revoke_others', email: who.email, detail: `${n} ${n === 1 ? 'device' : 'devices'}`, ...ctx });
    return json({ ok: true, signed_out: n });
  }

  return json({ error: 'unknown_action' }, 400);
}
