import { cfApiBase } from '@/app/lib/kv';
// Append-only audit trail in KV. Keys sort newest-first (inverted timestamp), so
// a prefix listing returns the latest entries first.

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () => `${cfApiBase()}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;
const KEEP_SECONDS = 400 * 24 * 3600;

export type AuditEntry = {
  at: string;
  actor: string;                                   // e-mail, 'system' or 'controller'
  role: 'admin' | 'owner' | 'system' | 'controller';
  action: string;                                  // e.g. 'site.transfer'
  email?: string;                                  // the tenant it concerns
  license_id?: string;
  detail?: string;
  site?: string;                                   // SESSIONS-1: the site's name at the time (activity line)
  ip?: string;                                     // masked (178.229.x.x), never a full address
  place?: string;                                  // "Amsterdam, Netherlands" (Cloudflare's own geo data)
  device?: string;                                 // "iPhone · Safari"
};

export async function logAudit(e: Omit<AuditEntry, 'at'>): Promise<void> {
  if (e.email && OWNER_ACTIONS.has(e.action)) await appendActivity(e.email, e);
  const at = new Date().toISOString();
  const inv = String(9_999_999_999_999 - Date.now()).padStart(13, '0');
  const id = crypto.randomUUID().slice(0, 8);
  try {
    await fetch(`${BASE()}/values/${encodeURIComponent(`audit:${inv}:${id}`)}?expiration_ttl=${KEEP_SECONDS}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' },
      body: JSON.stringify({ at, ...e }),
    });
  } catch {
    // An audit failure must never block the action it describes.
  }
}

export async function listAudit(limit = 200, email?: string): Promise<AuditEntry[]> {
  const r = await fetch(`${BASE()}/keys?prefix=audit%3A&limit=${Math.min(1000, limit * (email ? 5 : 1))}`, {
    headers: { Authorization: `Bearer ${CF_TOKEN()}` },
  });
  if (!r.ok) throw new Error(`KV list failed (${r.status})`);
  const data = (await r.json()) as { result: { name: string }[] };
  const rows = await Promise.all(
    data.result.map(async (k) => {
      const v = await fetch(`${BASE()}/values/${encodeURIComponent(k.name)}`, { headers: { Authorization: `Bearer ${CF_TOKEN()}` } });
      return v.ok ? (JSON.parse(await v.text()) as AuditEntry) : null;
    }),
  );
  const all = rows.filter((x): x is AuditEntry => !!x);
  return (email ? all.filter((x) => x.email === email.toLowerCase()) : all).slice(0, limit);
}

// ---- SESSIONS-1: the account's own activity ("Sign-in & security" on the account page)
// Per account: activity:<email> = the newest ACTIVITY_MAX events (newest first), each at most ACTIVITY_DAYS old, KV TTL
// ACTIVITY_DAYS. One value per account, so the page reads it in one go; every event also stays in the audit trail
// above (the full record, for support). A repeat of a noisy event (sign-in requested, wrong authenticator code) within
// an hour bumps a counter on the newest line instead of pushing older lines out.
import { kvGet as actGet, kvPut as actPut } from '@/app/lib/kv';

export const ACTIVITY_MAX = 50;
export const ACTIVITY_DAYS = 90;
export const OWNER_ACTIONS = new Set([
  'auth.signin', 'auth.request', 'auth.mfa_failed', 'auth.signout',
  'mfa.on', 'mfa.off', 'mfa.recovery',
  'session.revoke', 'session.revoke_others',
  'site.rename', 'site.claim', 'site.transfer', 'console.open',
]);
const COLLAPSE = new Set(['auth.request', 'auth.mfa_failed']);

export type ActivityEvent = {
  at: string; action: string; by?: 'you' | 'support' | 'controller';
  detail?: string; site?: string; ip?: string; place?: string; device?: string; n?: number;
};
const actKey = (email: string) => `activity:${email.toLowerCase()}`;

function readActivity(raw: string | null, now: number): ActivityEvent[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as ActivityEvent[];
    const cut = now - ACTIVITY_DAYS * 86_400_000;
    return Array.isArray(list) ? list.filter((x) => x && typeof x.action === 'string' && Date.parse(x.at) > cut) : [];
  } catch { return []; }
}

async function appendActivity(email: string, e: Omit<AuditEntry, 'at'>, now = Date.now()): Promise<void> {
  try {
    const list = readActivity(await actGet(actKey(email)), now);
    const by = e.role === 'admin' ? 'support' : e.role === 'controller' ? 'controller' : 'you';
    const ev: ActivityEvent = {
      at: new Date(now).toISOString(), action: e.action, by,
      ...(e.detail ? { detail: e.detail.slice(0, 200) } : {}), ...(e.site ? { site: e.site.slice(0, 80) } : {}),
      ...(e.ip ? { ip: e.ip } : {}), ...(e.place ? { place: e.place } : {}), ...(e.device ? { device: e.device } : {}),
    };
    const top = list[0];
    if (top && COLLAPSE.has(e.action) && top.action === e.action && top.detail === ev.detail && now - Date.parse(top.at) < 3_600_000) {
      list[0] = { ...ev, n: (top.n ?? 1) + 1 };
    } else {
      list.unshift(ev);
    }
    await actPut(actKey(email), JSON.stringify(list.slice(0, ACTIVITY_MAX)), ACTIVITY_DAYS * 86_400);
  } catch {
    // like the audit trail: never blocks the action it describes
  }
}

// Only ever called with the signed-in owner's own email (the API takes it from the session, never from the request).
export async function listActivity(email: string, now = Date.now()): Promise<ActivityEvent[]> {
  return readActivity(await actGet(actKey(email)), now);
}
