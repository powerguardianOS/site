// Read model for the admin console: customers (tenants) joined with their
// licenses and the live status their controllers report. Pure functions take
// plain data so they can be tested without KV; loadTenants() does the fetching.

import { getAccounts } from '@/app/lib/accounts';
import type { AccountRecord } from '@/app/lib/accounts';
import { getLicenses } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { getSiteStatus, isOnline } from '@/app/lib/site-status';
import type { SiteStatus } from '@/app/lib/site-status';

export type LicenseState = 'active' | 'expiring' | 'expired' | 'revoked' | 'none';

const DAY = 86_400_000;
export const EXPIRING_DAYS = 30;

export function licenseState(l: LicenseRecord, now = Date.now()): LicenseState {
  if (l.status === 'revoked') return 'revoked';
  if (l.expires_at) {
    const left = new Date(l.expires_at).getTime() - now;
    if (left < 0) return 'expired';
    if (left < EXPIRING_DAYS * DAY) return 'expiring';
  }
  return 'active';
}

export type Site = {
  license: LicenseRecord;
  status: SiteStatus | null;
  online: boolean;
};

export type Tenant = {
  email: string;
  registeredAt: string | null;
  licenses: LicenseRecord[];
  best: LicenseRecord | null; // the license that represents the tenant in lists
  state: LicenseState;
  sites: Site[];
  sitesOnline: number;
  devices: number;
  onBattery: number;
  lowBattery: number;
  lastBeat: number | null; // ms
};

const hasFlag = (raw: string, flag: string) => raw.toUpperCase().split(/\s+/).includes(flag);

export function buildTenants(
  accounts: AccountRecord[],
  licenses: LicenseRecord[],
  statuses: Map<string, SiteStatus | null>,
  now = Date.now(),
): Tenant[] {
  const byEmail = new Map<string, LicenseRecord[]>();
  for (const l of licenses) {
    const k = l.email.toLowerCase();
    byEmail.set(k, [...(byEmail.get(k) ?? []), l]);
  }
  const registered = new Map(accounts.map((a) => [a.email.toLowerCase(), a.created_at]));
  const emails = Array.from(new Set([...registered.keys(), ...byEmail.keys()])).sort();

  return emails.map((email) => {
    const lics = (byEmail.get(email) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const rank = (l: LicenseRecord) =>
      ({ active: 0, expiring: 1, expired: 2, revoked: 3, none: 4 })[licenseState(l, now)] + (l.plan === 'addon_connector' ? 10 : 0);
    const best = [...lics].sort((a, b) => rank(a) - rank(b))[0] ?? null;

    // An add-on license extends a site's connector allowance; it is not a site.
    const sites: Site[] = lics
      .filter((l) => l.plan !== 'addon_connector' && l.status !== 'revoked')
      .map((l) => {
        const status = statuses.get(l.id) ?? null;
        return { license: l, status, online: isOnline(status, now) };
      });

    const devs = sites.flatMap((s) => s.status?.devices ?? []);
    const beats = sites.map((s) => s.status?.received_at).filter((n): n is number => typeof n === 'number');

    return {
      email,
      registeredAt: registered.get(email) ?? null,
      licenses: lics,
      best,
      state: best ? licenseState(best, now) : 'none',
      sites,
      sitesOnline: sites.filter((s) => s.online).length,
      devices: devs.length,
      onBattery: devs.filter((d) => hasFlag(d.ups_status, 'OB')).length,
      lowBattery: devs.filter((d) => hasFlag(d.ups_status, 'LB')).length,
      lastBeat: beats.length ? Math.max(...beats) : null,
    };
  });
}

export async function loadTenants(): Promise<Tenant[]> {
  const [accounts, licenses] = await Promise.all([getAccounts(), getLicenses()]);
  const siteLicenses = licenses.filter((l) => l.plan !== 'addon_connector' && l.status !== 'revoked');
  const results = await Promise.all(siteLicenses.map((l) => getSiteStatus(l.id)));
  const statuses = new Map(siteLicenses.map((l, i) => [l.id, results[i]]));
  // The global admin's own login is an account, not a customer: hide it unless it holds a license.
  const admin = process.env.ADMIN_EMAIL?.toLowerCase();
  const held = new Set(licenses.map((l) => l.email.toLowerCase()));
  const customers = accounts.filter((a) => !(admin && a.email.toLowerCase() === admin && !held.has(admin)));
  return buildTenants(customers, licenses, statuses);
}

export type Attention = {
  level: 'critical' | 'warning' | 'info';
  email: string;
  text: string;
  at: number | null; // ms the condition started, when known
};

const SEVERITY = { critical: 0, warning: 1, info: 2 } as const;

export function attentionItems(tenants: Tenant[], now = Date.now()): Attention[] {
  const out: Attention[] = [];
  for (const t of tenants) {
    for (const s of t.sites) {
      const name = s.status?.site_name ?? 'site';
      const dev = s.status?.devices ?? [];
      const lb = dev.filter((d) => hasFlag(d.ups_status, 'LB')).length;
      const ob = dev.filter((d) => hasFlag(d.ups_status, 'OB')).length;
      if (s.online && lb) out.push({ level: 'critical', email: t.email, text: `${name}: ${lb} device${lb > 1 ? 's' : ''} on LOW battery`, at: s.status!.received_at });
      else if (s.online && ob) out.push({ level: 'critical', email: t.email, text: `${name}: ${ob} device${ob > 1 ? 's' : ''} running on battery`, at: s.status!.received_at });
      if (s.status && !s.online) out.push({ level: 'warning', email: t.email, text: `${name}: controller offline`, at: s.status.received_at });
      if (!s.status && licenseState(s.license, now) !== 'expired') {
        const age = now - new Date(s.license.created_at).getTime();
        if (age > DAY) out.push({ level: 'info', email: t.email, text: 'License active but the controller has never connected', at: new Date(s.license.created_at).getTime() });
      }
    }
    if (t.best && t.state === 'expiring') {
      const days = Math.ceil((new Date(t.best.expires_at!).getTime() - now) / DAY);
      out.push({ level: 'warning', email: t.email, text: `License expires in ${days} day${days === 1 ? '' : 's'}`, at: null });
    }
    if (t.best && t.state === 'expired') out.push({ level: 'warning', email: t.email, text: 'License has expired', at: null });
  }
  return out.sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level]);
}
