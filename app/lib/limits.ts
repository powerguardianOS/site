// Pure capacity rules for site licenses and their connector add-ons.
//
// A site has one license. Extra connectors are sold/granted as separate
// `addon_connector` licenses that point at that site license (`parent_id`),
// each with its own term. A site's capacity is its base limit plus every
// add-on that is still running. Base limit 0 means unlimited and stays so.

import type { LicenseRecord } from '@/app/lib/license-db';

export function isRunning(l: LicenseRecord, now = Date.now()): boolean {
  return l.status === 'active' && (!l.expires_at || new Date(l.expires_at).getTime() > now);
}

export function addonsOf(site: LicenseRecord, all: LicenseRecord[]): LicenseRecord[] {
  return all.filter((l) => l.plan === 'addon_connector' && l.parent_id === site.id);
}

export function effectiveLimit(site: LicenseRecord, all: LicenseRecord[], now = Date.now()): number {
  if (site.connector_limit === 0) return 0;
  return site.connector_limit + addonsOf(site, all).filter((a) => isRunning(a, now)).reduce((n, a) => n + a.connector_limit, 0);
}

// Same result as effectiveLimit, but reads only this site's own add-ons. Used on
// the hot path (every heartbeat) instead of loading every license.
export async function limitFor(site: LicenseRecord, getOne: (id: string) => Promise<LicenseRecord | null>, now = Date.now()): Promise<number> {
  if (site.connector_limit === 0) return 0;
  const add = await Promise.all((site.addon_ids ?? []).map(getOne));
  return site.connector_limit + add.filter((a): a is LicenseRecord => !!a && isRunning(a, now)).reduce((n, a) => n + a.connector_limit, 0);
}
