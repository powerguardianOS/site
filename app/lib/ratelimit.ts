// Fixed-window rate limiter on Workers KV. KV is not atomic, so a burst of
// parallel requests can slip a few extra through — fine for abuse protection,
// not for exact metering. Fails open: a KV hiccup must not lock customers out.

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

/** Returns true when the caller is over the limit (request should be refused). */
export async function rateLimited(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `rl:${bucket}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  try {
    const r = await fetch(`${BASE()}/values/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${CF_TOKEN()}` },
    });
    const count = r.ok ? parseInt(await r.text(), 10) || 0 : 0;
    if (count >= limit) return true;
    await fetch(
      `${BASE()}/values/${encodeURIComponent(key)}?expiration_ttl=${Math.max(60, windowSec * 2)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
        body: String(count + 1),
      },
    );
    return false;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}
