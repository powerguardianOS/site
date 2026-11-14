export const runtime = 'edge';

import { kvGet, kvPut, kvDel } from '@/app/lib/kv';

// LOGIN-1: a sign-in link is opened with GET by more than the user: mail scanners, link previews, browser prefetch.
// So reading a link (peekMagicToken, for the confirm page) never uses it up; only the confirm button (a same-origin
// POST, see app/api/auth/verify) calls consumeMagicToken.

const TOKEN_RE = /^[0-9a-f]{32}$/;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createMagicToken(email: string): Promise<string> {
  const token = randomHex(16);
  const expires = Date.now() + 15 * 60 * 1000;
  await kvPut(`magic:${token}`, JSON.stringify({ email, expires }), 20 * 60);
  return token;
}

async function read(token: string): Promise<string | null> {
  if (!TOKEN_RE.test(token)) return null;
  const raw = await kvGet(`magic:${token}`);
  if (!raw) return null;
  try {
    const { email, expires } = JSON.parse(raw);
    if (typeof email !== 'string' || !(expires >= Date.now())) return null;
    return email;
  } catch {
    return null;
  }
}

// The email the link is for, or null when it is unknown, used or expired. Does not use the link up.
export async function peekMagicToken(token: string): Promise<string | null> {
  return read(token);
}

// Uses the link up: returns the email once, then null.
export async function consumeMagicToken(token: string): Promise<string | null> {
  const email = await read(token);
  if (TOKEN_RE.test(token)) await kvDel(`magic:${token}`);
  return email;
}

// "r***@gmail.com": enough for the owner to recognise, not a full address for whoever else opens the link.
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return email[0] + '***' + email.slice(at);
}
