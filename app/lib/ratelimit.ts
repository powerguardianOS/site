// Fixed-window rate limiter on Workers KV. KV is not atomic, so a burst of
// parallel requests can slip a few extra through — fine for abuse protection,
// not for exact metering. Fails open: a KV hiccup must not lock customers out.

import { kvGet, kvPut } from '@/app/lib/kv';

/** Returns true when the caller is over the limit (request should be refused).
 *  failClosed: when KV cannot be read or written, throw instead of letting the
 *  request through (use it for anything that sends mail or mints credentials). */
export async function rateLimited(bucket: string, limit: number, windowSec: number, failClosed = false): Promise<boolean> {
  const key = `rl:${bucket}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  try {
    const count = parseInt((await kvGet(key)) ?? '0', 10) || 0;
    if (count >= limit) return true;
    await kvPut(key, String(count + 1), windowSec * 2);
    return false;
  } catch (err) {
    if (failClosed) throw err; // caller answers 503: no mail, no credential
    return false;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}
