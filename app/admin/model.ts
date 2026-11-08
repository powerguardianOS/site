// View model of the admin console. Pure functions over the tenants read model
// (app/lib/tenants.ts), so every page counts the same way and the numbers on
// the overview always match the lists they link to.
//
// Counting rules (one place, used everywhere):
// - A license is a site license that is not an add-on and not a founder site.
//   Founder sites (minted from a founder license) are controllers of that license.
// - "Active" = not revoked and not expired (includes "expiring").
// - A site counts for health while its license runs: online / offline / never connected.

import type { LicenseRecord } from '@/app/lib/license-db';
import type { AuditEntry } from '@/app/lib/audit';
import { licenseState, EXPIRING_DAYS } from '@/app/lib/tenants';
import type { LicenseState, Site, Tenant } from '@/app/lib/tenants';
import type { Tone } from './ui';
import { shortDate } from './format';

const DAY = 86_400_000;
const LEASE_DAYS = 30; // matches app/lib/lease.ts: a check-in renews the lease for 30 days

const fmtDate = (ms: number, year = true) => shortDate(ms, year);

export function days(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

// "3 days", "5 hours", "12 min" — for "offline for …".
export function span(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 90) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hour${h === 1 ? '' : 's'}`;
  return days(Math.round(h / 24));
}

export function siteName(l: LicenseRecord, s?: Site | null): string {
  return l.site_name ?? s?.status?.site_name ?? 'Unnamed site';
}

// The license's own state as plain words.
export function termStatus(l: LicenseRecord, now = Date.now()): { tone: Tone; label: string; state: LicenseState } {
  const state = licenseState(l, now);
  if (state === 'revoked') return { state, tone: 'off', label: l.revoked_with_root ? 'Revoked with founder license' : 'Revoked' };
  if (!l.expires_at) return { state, tone: 'ok', label: 'Active' };
  const left = new Date(l.expires_at).getTime() - now;
  if (state === 'expired') return { state, tone: 'bad', label: `Expired ${span(-left)} ago` };
  if (state === 'expiring') return { state, tone: 'warn', label: `Expires in ${days(Math.max(1, Math.ceil(left / DAY)))}` };
  return { state, tone: 'ok', label: 'Active' };
}

export function termText(l: LicenseRecord): string {
  return l.expires_at ? `Until ${fmtDate(new Date(l.expires_at).getTime())}` : 'Never expires';
}

export type Check = { tone: Tone; label: string; detail: string };

// Last check-in of one or more sites, as one line.
export function checkIn(sites: Site[], now = Date.now()): Check {
  const beats = sites.map((s) => s.status?.received_at).filter((n): n is number => typeof n === 'number');
  // Check-ins are kept 7 days: a linked controller without one has been silent longer.
  if (!beats.length && sites.some((s) => s.license.claimed_by)) return { tone: 'warn', label: 'Offline for over a week', detail: 'Its 30-day lease may have run out' };
  if (!beats.length) return { tone: 'idle', label: 'Never connected', detail: 'No check-in yet' };
  const last = Math.max(...beats);
  const online = sites.some((s) => s.online);
  const lease = Math.min(last + LEASE_DAYS * DAY, ...sites.map((s) => (s.license.expires_at ? new Date(s.license.expires_at).getTime() : Infinity)));
  if (online) return { tone: 'ok', label: 'Online', detail: `Checked in ${span(now - last)} ago · lease to ${fmtDate(lease, false)}` };
  return { tone: 'warn', label: `Offline for ${span(now - last)}`, detail: `Lease runs to ${fmtDate(lease, false)}` };
}

export type LicenseRow = {
  id: string;
  email: string;
  site: string;
  plan: LicenseRecord['plan'];
  status: { tone: Tone; label: string; state: LicenseState };
  term: string;
  controllers: { used: number; limit: number | null }; // null = unlimited
  connectors: { used: number; limit: number };          // limit 0 = unlimited
  check: Check;
  foundersites: string[];  // names of the founder sites this license carries
  followers: number;       // founder sites that follow a revoke / reactivate of this license
  revoked: boolean;
};

export function licenseRows(tenants: Tenant[], now = Date.now()): LicenseRow[] {
  const rows: LicenseRow[] = [];
  for (const t of tenants) {
    for (const s of t.allSites) {
      const l = s.license;
      if (l.minted_from) continue;
      const children = t.allSites.filter((c) => c.license.minted_from === l.id);
      const running = children.filter((c) => c.license.status !== 'revoked');
      const group = l.status === 'revoked' ? [s] : [s, ...running];
      const linked = (x: Site) => !!(x.license.claimed_by || x.status);
      rows.push({
        id: l.id,
        email: t.email,
        site: siteName(l, s),
        plan: l.plan,
        status: termStatus(l, now),
        term: termText(l),
        controllers: { used: group.filter(linked).length, limit: l.plan === 'founder' ? null : 1 },
        connectors: { used: group.reduce((n, x) => n + (x.status?.devices.length ?? 0), 0), limit: s.limit },
        check: l.status === 'revoked' ? { tone: 'off', label: 'Not allowed', detail: 'License revoked' } : checkIn(group, now),
        foundersites: children.map((c) => siteName(c.license, c)),
        followers: l.status === 'revoked' ? children.filter((c) => c.license.revoked_with_root).length : running.length,
        revoked: l.status === 'revoked',
      });
    }
  }
  // Problems first, then by customer.
  const order: Record<LicenseState, number> = { expired: 0, expiring: 1, active: 2, revoked: 3, none: 4 };
  return rows.sort((a, b) => order[a.status.state] - order[b.status.state] || a.email.localeCompare(b.email) || a.site.localeCompare(b.site));
}

export function licenseCounts(rows: LicenseRow[]) {
  const by = (s: LicenseState) => rows.filter((r) => r.status.state === s).length;
  return { all: rows.length, active: by('active') + by('expiring'), expiring: by('expiring'), expired: by('expired'), revoked: by('revoked') };
}

// Sites whose license runs (founder sites included): what "sites online" counts.
export function siteCounts(tenants: Tenant[], now = Date.now()) {
  const live = tenants.flatMap((t) => t.sites).filter((s) => {
    const st = licenseState(s.license, now);
    return st !== 'expired' && st !== 'revoked';
  });
  return {
    total: live.length,
    online: live.filter((s) => s.online).length,
    offline: live.filter((s) => (s.status && !s.online) || (!s.status && s.license.claimed_by)).length,
    never: live.filter((s) => !s.status && !s.license.claimed_by).length,
  };
}

const hasFlag = (raw: string, flag: string) => raw.toUpperCase().split(/\s+/).includes(flag);

export type Attention = {
  level: 'critical' | 'warning' | 'info';
  email: string;
  title: string;   // what, with the real name
  cause: string;   // why, concrete
  action: string;  // what to do
  href: string;
  at: number | null;
};

// "Needs attention": one line per problem, each with the site's real name, the
// cause and the action that solves it.
export function needsAttention(tenants: Tenant[], now = Date.now()): Attention[] {
  const out: Attention[] = [];
  const href = (email: string) => `/admin/customers/${encodeURIComponent(email)}`;
  for (const t of tenants) {
    for (const s of t.sites) {
      const st = licenseState(s.license, now);
      if (st === 'expired') continue;
      const name = siteName(s.license, s);
      const devs = s.status?.devices ?? [];
      const low = devs.filter((d) => hasFlag(d.ups_status, 'LB'));
      const ob = devs.filter((d) => hasFlag(d.ups_status, 'OB'));
      if (s.online && (low.length || ob.length)) {
        const d = (low[0] ?? ob[0]);
        const more = low.length + ob.length - 1;
        out.push({
          level: 'critical', email: t.email, href: href(t.email), at: s.status!.received_at,
          title: `${name}: ${d.name || 'a UPS'} ${low.length ? 'on low battery' : 'on battery'}`,
          cause: `${Math.round(d.battery_pct)}% left, about ${Math.max(1, Math.round(d.runtime_sec / 60))} min runtime${more > 0 ? ` · ${more} more UPS${more > 1 ? 'es' : ''} on battery` : ''}`,
          action: 'Open site',
        });
      }
      if (s.status && !s.online) {
        out.push({
          level: 'warning', email: t.email, href: href(t.email), at: s.status.received_at,
          title: `${name} offline for ${span(now - s.status.received_at)}`,
          cause: `${s.license.claimed_hostname ? `Controller ${s.license.claimed_hostname}` : 'The controller'} stopped checking in. Its lease keeps it running until ${fmtDate(s.status.received_at + LEASE_DAYS * DAY, false)}.`,
          action: 'Check site',
        });
      }
      if (!s.status && s.license.claimed_by) {
        out.push({
          level: 'warning', email: t.email, href: href(t.email), at: null,
          title: `${name} offline for over a week`,
          cause: `${s.license.claimed_hostname ? `Controller ${s.license.claimed_hostname}` : 'Its controller'} has not checked in for more than 7 days; its lease may have run out.`,
          action: 'Check site',
        });
      }
      if (!s.status && !s.license.claimed_by && now - new Date(s.license.created_at).getTime() > DAY) {
        out.push({
          level: 'info', email: t.email, href: href(t.email), at: new Date(s.license.created_at).getTime(),
          title: `${name} never connected`,
          cause: `License created ${span(now - new Date(s.license.created_at).getTime())} ago. The customer still has to link it on the controller (Settings → License).`,
          action: 'Open customer',
        });
      }
    }
    for (const s of t.allSites) {
      const name = siteName(s.license, s);
      for (const c of s.license.copies ?? []) {
        if (c.decision === 'removed') continue;
        const ends = new Date(c.first_seen).getTime() + 30 * DAY;
        if (ends > now) out.push({
          level: 'warning', email: t.email, href: href(t.email), at: new Date(c.first_seen).getTime(),
          title: `Copy of ${name} found`,
          cause: `${c.hostname || c.controller_id.slice(0, 8)} uses this license but is not its controller. Locks in ${days(Math.max(1, Math.ceil((ends - now) / DAY)))} unless the customer decides.`,
          action: 'Review copy',
        });
      }
    }
    for (const l of t.licenses) {
      if (l.plan === 'addon_connector' || l.minted_from || !l.expires_at) continue;
      const st = licenseState(l, now);
      const left = new Date(l.expires_at).getTime() - now;
      if (st === 'expiring') out.push({
        level: 'warning', email: t.email, href: href(t.email), at: null,
        title: `${siteName(l)}: license expires in ${days(Math.max(1, Math.ceil(left / DAY)))}`,
        cause: `${l.plan.charAt(0).toUpperCase() + l.plan.slice(1)} license ends on ${fmtDate(new Date(l.expires_at).getTime())}.`,
        action: 'Extend',
      });
      if (st === 'expired' && -left < 90 * DAY) out.push({
        level: 'warning', email: t.email, href: href(t.email), at: null,
        title: `${siteName(l)}: license expired ${span(-left)} ago`,
        cause: `Ended on ${fmtDate(new Date(l.expires_at).getTime())}. The controller runs on until its lease ends, then stops.`,
        action: 'Renew or delete',
      });
    }
  }
  const sev = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => sev[a.level] - sev[b.level] || (b.at ?? now) - (a.at ?? now));
}

export const EXPIRING_WINDOW_DAYS = EXPIRING_DAYS;

// ---- audit log in plain words ----

const VERB: Record<string, string> = {
  'license.create': 'created a license',
  'license.update': 'changed a license',
  'license.revoke': 'revoked a license',
  'license.reactivate': 'reactivated a license',
  'addon.create': 'added connectors',
  'addon.delete': 'removed a connector add-on',
  'site.mint': 'added a founder site',
  'site.claim': 'linked a controller',
  'site.transfer': 'moved a site to another controller',
  'site.adopt': 'took over a site',
  'site.rename': 'renamed a site',
  'site.release': 'released a controller',
  'site.update': 'changed site settings',
  'site.delete': 'deleted a site',
  'copy.detected': 'reported an unconfirmed copy',
  'copy.replace': 'replaced the controller with its copy',
  'copy.keep': 'kept a copy as its own site',
  'copy.remove': 'switched off a copy',
  'token.rotate': 'rotated a license token',
  'tenant.delete': 'deleted a customer',
  'lease.offline': 'issued a 12-month offline lease',
};

export const auditKind = (action: string): Tone =>
  /revoke|delete|remove/.test(action) ? 'bad' : /copy|rotate|release|transfer/.test(action) ? 'warn' : /create|mint|claim|reactivate|adopt/.test(action) ? 'ok' : 'idle';

const ISO = /\b\d{4}-\d{2}-\d{2}T[\d:.]+Z\b/g;
const UUID = /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g;

function plainDetail(action: string, detail?: string): string {
  if (!detail) return '';
  const t = detail.trim();
  if (t.startsWith('{')) {
    try {
      const p = JSON.parse(t) as Record<string, unknown>;
      const parts: string[] = [];
      if ('expires_at' in p) parts.push(p.expires_at ? `ends ${fmtDate(new Date(String(p.expires_at)).getTime())}` : 'never expires');
      if ('connector_limit' in p) parts.push(p.connector_limit === 0 ? 'unlimited connectors' : `${p.connector_limit} connectors`);
      if ('plan' in p) parts.push(`plan ${p.plan}`);
      if ('site_name' in p) parts.push(`name “${p.site_name}”`);
      if ('offline_allowed' in p) parts.push(p.offline_allowed ? 'offline license allowed' : 'offline license not allowed');
      if ('status' in p && !action.startsWith('license.')) parts.push(String(p.status));
      return parts.join(' · ');
    } catch { /* fall through to text */ }
  }
  if (/^follows its founder licen[cs]e/.test(t)) return 'together with its founder license';
  return t.replace(ISO, (m) => fmtDate(new Date(m).getTime())).replace(UUID, '$1…').replace(/, ends never/, ', never expires');
}

export type AuditLine = {
  at: number;
  who: string;      // a person's e-mail, "Controller" or "System"
  role: string;     // Admin / Customer / Controller / System
  what: string;     // plain sentence part
  detail: string;
  customer: string | null;
  tone: Tone;
};

export function auditLine(e: AuditEntry): AuditLine {
  const role = { admin: 'Admin', owner: 'Customer', controller: 'Controller', system: 'System' }[e.role] ?? e.role;
  return {
    at: new Date(e.at).getTime(),
    who: e.role === 'controller' ? 'A controller' : e.role === 'system' ? 'The system' : e.actor,
    role,
    what: VERB[e.action] ?? e.action.replace(/[._]/g, ' '),
    detail: plainDetail(e.action, e.detail),
    customer: e.email ?? null,
    tone: auditKind(e.action),
  };
}

export function dayLabel(ms: number, now = Date.now()): string {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const diff = Math.floor((d0.getTime() - new Date(ms).setHours(0, 0, 0, 0)) / DAY);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ms).getDay()]} ${shortDate(ms, new Date(ms).getFullYear() !== d0.getFullYear())}`;
}

// The clock, outside the components (render functions must not read it directly).
export const nowMs = () => Date.now();
