import type { LicenseRecord } from '@/app/lib/license-db';

export type DisplayStatus = 'active' | 'expired' | 'revoked';

// `status` in KV is only ever active|revoked; expiry is derived from the date.
export function displayStatus(l: LicenseRecord): DisplayStatus {
  if (l.status === 'revoked') return 'revoked';
  if (l.expires_at && new Date(l.expires_at).getTime() < Date.now()) return 'expired';
  return 'active';
}

export const STATUS_STYLE: Record<DisplayStatus, string> = {
  active: 'bg-green-900/40 text-green-400',
  expired: 'bg-amber-900/40 text-amber-400',
  revoked: 'bg-red-900/40 text-red-400',
};
