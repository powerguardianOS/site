// AUTO-SSO: "Open Console" lands the owner signed in on the controller (like UniFi Site Manager → console).
//
// When the portal mints a console link (app/api/account/relay-session) it also leaves a console intent: an HttpOnly
// cookie on powerguardian.cloud, only sent to /sso/authorize, named for that site (pg_ci_<site label>), alive for
// INTENT_TTL_S seconds. Its value is signed (HMAC, own derived key) over the site id, the expiry, a random id and a
// hash of the browser's PG Cloud session cookie, so it is
//   - site-bound   (an intent for Acer never completes a sign-in to HP, whatever cookie name it is put under),
//   - session-bound (another session — or another account — cannot use it),
//   - short-lived  (two minutes: the console page starts the sign-in within seconds),
//   - single-use   (the random id is marked used in KV at the first try, successful or not).
// /sso/authorize completes without the Continue tap ONLY with a valid intent, for a session that passed two-step
// sign-in, for the account that owns the site, returning to that very site's own console host (never a LAN address),
// and not from a cross-site navigation. Anything else: the Continue page exactly as before. The statement itself is the
// normal CLOUD-SSO statement; the controller checks it the same way (nonce bound to its own browser cookie, aud, site).
import { hmacKey, b64u, unb64u } from '@/app/lib/keys';
import { kvGet, kvPut } from '@/app/lib/kv';
import { siteLabel } from '@/app/lib/relay-mint';

export const INTENT_TTL_S = 120;
const KEY_INFO = 'pg console intent v1';
const enc = new TextEncoder();

export async function intentCookieName(siteId: string): Promise<string> {
  return `pg_ci_${await siteLabel(siteId)}`;
}

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const signedBytes = async (siteId: string, exp: number, id: string, session: string) =>
  enc.encode(`ci1|${siteId}|${exp}|${id}|${await sha256hex(session)}`);

// The Set-Cookie header value for a fresh intent, or null when no key is configured (then Open Console simply shows
// the Continue page as before).
export async function mintConsoleIntent(siteId: string, session: string, now = Date.now()): Promise<string | null> {
  const key = await hmacKey(KEY_INFO);
  if (!key || !session) return null;
  const exp = Math.floor(now / 1000) + INTENT_TTL_S;
  const idb = new Uint8Array(16); crypto.getRandomValues(idb);
  const id = [...idb].map((b) => b.toString(16).padStart(2, '0')).join('');
  const sig = b64u(await crypto.subtle.sign('HMAC', key, await signedBytes(siteId, exp, id, session)));
  return `${await intentCookieName(siteId)}=ci1.${exp}.${id}.${sig}; Path=/sso/authorize; Max-Age=${INTENT_TTL_S}; HttpOnly; Secure; SameSite=Lax`;
}

export async function clearConsoleIntent(siteId: string): Promise<string> {
  return `${await intentCookieName(siteId)}=; Path=/sso/authorize; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Checks an intent cookie value for this site and session and burns it. True only when everything holds and it was
// not used before. Any error (KV down, bad value) is a plain false: the caller shows the Continue page.
export async function consumeConsoleIntent(value: string, siteId: string, session: string, now = Date.now()): Promise<boolean> {
  try {
    const m = /^ci1\.(\d{1,12})\.([0-9a-f]{32})\.([A-Za-z0-9_-]{20,100})$/.exec(value);
    if (!m || !session) return false;
    const exp = Number(m[1]), id = m[2];
    const t = Math.floor(now / 1000);
    if (exp <= t || exp - t > INTENT_TTL_S + 5) return false;
    const key = await hmacKey(KEY_INFO);
    if (!key) return false;
    const ok = await crypto.subtle.verify('HMAC', key, unb64u(m[3]) as BufferSource, await signedBytes(siteId, exp, id, session));
    if (!ok) return false;
    if (await kvGet(`ci:used:${id}`)) return false;
    await kvPut(`ci:used:${id}`, '1', INTENT_TTL_S * 2);
    return true;
  } catch {
    return false;
  }
}
