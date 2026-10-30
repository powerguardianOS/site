export const runtime = 'edge';

import { kvGet, kvPut, kvDel } from '@/app/lib/kv';

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(email: string): Promise<string> {
  const token = randomHex(32);
  const expires = Date.now() + 86400000;
  await kvPut(`session:${token}`, JSON.stringify({ email, expires }));
  return token;
}

export async function getSession(id: string): Promise<string | null> {
  const raw = await kvGet(`session:${id}`);
  if (!raw) return null;
  try {
    const { email, expires } = JSON.parse(raw);
    if (expires < Date.now()) return null;
    return email;
  } catch {
    return null;
  }
}

export async function deleteSession(id: string): Promise<void> {
  await kvDel(`session:${id}`);
}
