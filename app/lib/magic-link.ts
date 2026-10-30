export const runtime = 'edge';

import { kvGet, kvPut, kvDel } from '@/app/lib/kv';

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createMagicToken(email: string): Promise<string> {
  const token = randomHex(16);
  const expires = Date.now() + 15 * 60 * 1000;
  await kvPut(`magic:${token}`, JSON.stringify({ email, expires }));
  return token;
}

export async function verifyMagicToken(token: string): Promise<string | null> {
  const raw = await kvGet(`magic:${token}`);
  if (!raw) return null;
  try {
    const { email, expires } = JSON.parse(raw);
    await kvDel(`magic:${token}`);
    if (expires < Date.now()) return null;
    return email as string;
  } catch {
    return null;
  }
}
