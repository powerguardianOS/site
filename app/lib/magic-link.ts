export const runtime = 'edge';

import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { getSignInRequest } from '@/app/lib/signin-code';

// LOGIN-1: a sign-in link is opened with GET by more than the user: mail scanners, link previews, browser prefetch.
// So reading a link (peekMagicToken, for the confirm page) never uses it up; only the confirm button (a same-origin
// POST, see app/api/auth/verify) calls consumeMagicToken.
// LOGIN-2: a link carries the id of its pending sign-in (`req`, app/lib/signin-code.ts). It only works while that is
// still pending: the code used, or 5 wrong codes, kill the link too.

const TOKEN_RE = /^[0-9a-f]{32}$/;

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createMagicToken(email: string, req?: string): Promise<string> {
  const token = randomHex(16);
  const expires = Date.now() + 15 * 60 * 1000;
  await kvPut(`magic:${token}`, JSON.stringify({ email, expires, ...(req ? { req } : {}) }), 20 * 60);
  return token;
}

export type MagicLink = { email: string; req?: string };

async function read(token: string): Promise<MagicLink | null> {
  if (!TOKEN_RE.test(token)) return null;
  const raw = await kvGet(`magic:${token}`);
  if (!raw) return null;
  let link: MagicLink;
  try {
    const { email, expires, req } = JSON.parse(raw);
    if (typeof email !== 'string' || !(expires >= Date.now())) return null;
    link = { email, ...(typeof req === 'string' ? { req } : {}) };
  } catch {
    return null;
  }
  if (link.req) {
    const rec = await getSignInRequest(link.req);
    if (!rec || rec.state !== 'pending') return null;
  }
  return link;
}

// The link (email, pending sign-in), or null when it is unknown, used or expired. Does not use the link up.
export async function peekMagicToken(token: string): Promise<MagicLink | null> {
  return read(token);
}

// Uses the link up: returns it once, then null.
export async function consumeMagicToken(token: string): Promise<MagicLink | null> {
  const link = await read(token);
  if (TOKEN_RE.test(token)) await kvDel(`magic:${token}`);
  return link;
}

// "r***@gmail.com": enough for the owner to recognise, not a full address for whoever else opens the link.
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return email[0] + '***' + email.slice(at);
}
