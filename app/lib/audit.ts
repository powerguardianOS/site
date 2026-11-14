import { kvGet, kvPut, kvList } from '@/app/lib/kv';
// Append-only audit trail in KV. Keys sort newest-first (inverted timestamp), so
// a prefix listing returns the latest entries first.

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
    await kvPut(`audit:${inv}:${id}`, JSON.stringify({ at, ...e }), KEEP_SECONDS);
  } catch {
    // An audit failure must never block the action it describes.
  }
}

export async function listAudit(limit = 200, email?: string): Promise<AuditEntry[]> {
  const names = await kvList('audit:', Math.min(1000, limit * (email ? 5 : 1)));
  const rows = await Promise.all(
    names.map(async (k) => {
      const v = await kvGet(k).catch(() => null);
      return v ? (JSON.parse(v) as AuditEntry) : null;
    }),
  );
  const all = rows.filter((x): x is AuditEntry => !!x);
  return (email ? all.filter((x) => x.email === email.toLowerCase()) : all).slice(0, limit);
}
