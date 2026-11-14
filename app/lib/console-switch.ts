// AUTO-SSO from a controller's site switcher (on Acer tap HP → land signed in on HP through the relay).
//
// The switcher asks the cloud server to server (/api/cloud/sites/console), so the browser never talks to the cloud at
// that moment and cannot get a console intent cookie there. Instead the cloud hands the controller an extra open_url:
// a switch ticket on powerguardian.cloud. It is
//   - account-bound: made only when the controller's user is linked to the cloud account that owns both licences
//     (the controller names it as actor; the cloud checks it is the owner of the calling licence AND of the target);
//   - site-bound and single-use: KV cs:<48 hex> = {site_id, email, exp}, deleted at the first successful open;
//   - short-lived: SWITCH_TTL_S, long enough to sign in to PG Cloud on the way when the browser has no session.
// GET /console/open?t=… (app/console/open) then needs the browser's own PG Cloud session of that same account (sign in
// first, then it continues), burns the ticket, mints the target's console link like Open Console and sets the console
// intent (app/lib/console-intent.ts), so the target controller signs in by itself.
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';

export const SWITCH_TTL_S = 600;
export const TICKET_RE = /^[0-9a-f]{48}$/;

// lan: the site switcher on the LAN — the ticket then ends on that private address (from the site's own heartbeat,
// never from the request) with ?sso=auto, instead of a relay console link.
export type SwitchTicket = { site_id: string; email: string; exp: number; lan?: string };

export async function createSwitchTicket(siteId: string, email: string, now = Date.now(), lan?: string): Promise<string> {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  const t = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const rec: SwitchTicket = { site_id: siteId, email: email.toLowerCase(), exp: Math.floor(now / 1000) + SWITCH_TTL_S, ...(lan ? { lan } : {}) };
  await kvPut(`cs:${t}`, JSON.stringify(rec), SWITCH_TTL_S);
  return t;
}

// The ticket when it exists and has not expired (not burned yet), else null.
export async function peekSwitchTicket(t: string, now = Date.now()): Promise<SwitchTicket | null> {
  if (!TICKET_RE.test(t)) return null;
  try {
    const raw = await kvGet(`cs:${t}`);
    if (!raw) return null;
    const rec = JSON.parse(raw) as SwitchTicket;
    return typeof rec.site_id === 'string' && typeof rec.email === 'string' && rec.exp > Math.floor(now / 1000) ? rec : null;
  } catch {
    return null;
  }
}

export async function burnSwitchTicket(t: string): Promise<void> {
  if (TICKET_RE.test(t)) await kvDel(`cs:${t}`);
}
