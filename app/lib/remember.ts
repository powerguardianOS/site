// PASSKEYS-1: "Continue as r***@gmail.com" on /login (an account chooser like UniFi's). After a sign-in the account page
// stores in this browser's localStorage only { masked e-mail, handle, passkey yes/no }. The handle is 32 random bytes
// that mean nothing by themselves; KV keeps remember:<sha256(handle)> → e-mail (400 days), so a remembered browser can
// ask for a sign-in link or code without the e-mail ever being stored in clear on the device. The handle is not a
// credential: it can only ask for a mail to the account's own address (same limits as typing the address), never sign
// in. "Forget" deletes both sides. The passkey itself needs no hint: the browser lists this site's passkeys.
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { b64u } from '@/app/lib/keys';
import { sha256 } from '@/app/lib/webauthn';

export const REMEMBER_TTL_S = 400 * 24 * 3600;
export const HANDLE_RE = /^[A-Za-z0-9_-]{43}$/;
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const key = async (handle: string) => `remember:${hex(await sha256('pg remember|' + handle))}`;

export async function emailForHandle(handle: unknown): Promise<string | null> {
  if (typeof handle !== 'string' || !HANDLE_RE.test(handle)) return null;
  return kvGet(await key(handle));
}

// The handle for this browser: the one it already has when it belongs to this account (its 400 days start again),
// else a new one.
export async function rememberHandle(email: string, current: unknown): Promise<string> {
  const e = email.toLowerCase();
  const handle = typeof current === 'string' && HANDLE_RE.test(current) && (await emailForHandle(current)) === e
    ? current
    : b64u(crypto.getRandomValues(new Uint8Array(32)));
  await kvPut(await key(handle), e, REMEMBER_TTL_S);
  return handle;
}

export async function forgetHandle(handle: unknown): Promise<void> {
  if (typeof handle === 'string' && HANDLE_RE.test(handle)) await kvDel(await key(handle));
}
