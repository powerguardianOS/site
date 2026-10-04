// Append-only audit trail in KV. Keys sort newest-first (inverted timestamp), so
// a prefix listing returns the latest entries first.

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () => `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;
const KEEP_SECONDS = 400 * 24 * 3600;

export type AuditEntry = {
  at: string;
  actor: string;                                   // e-mail, 'system' or 'controller'
  role: 'admin' | 'owner' | 'system' | 'controller';
  action: string;                                  // e.g. 'site.transfer'
  email?: string;                                  // the tenant it concerns
  license_id?: string;
  detail?: string;
};

export async function logAudit(e: Omit<AuditEntry, 'at'>): Promise<void> {
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
