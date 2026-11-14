// ACCOUNT-UI: what the account page ("My sites") shows, as plain data. One tile per site (name, model, one status line,
// 24 h power bar, plan); licenses that no controller uses yet go to their own quiet line. Pure (no KV), so it is unit-tested (tests/account-view.test.mts).
import type { LicenseRecord } from '@/app/lib/license-db';
import type { SiteStatus } from '@/app/lib/site-status';
import { isOnline } from '@/app/lib/site-status';
import { effectiveLimit } from '@/app/lib/limits';
import { power } from '@/app/lib/site-summary';
import type { SiteTone } from '@/app/lib/site-summary';
import { last24h } from '@/app/lib/power-history';

export type SitePlan = 'home' | 'pro' | 'founder';
export const PLAN_LABEL: Record<SitePlan, string> = { founder: 'Founder', pro: 'Pro', home: 'Home' };

// Internal placeholders a controller or an old license may carry. Never shown as a name.
const INTERNAL_NAMES = new Set(['default-site', 'default_site']);

function usable(name: string | null | undefined, l: LicenseRecord): string | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  const low = n.toLowerCase();
  if (INTERNAL_NAMES.has(low) || low === (l.site_id ?? '').toLowerCase() || low === l.id.toLowerCase()) return null;
  const hosts = [l.claimed_hostname, ...(l.copies ?? []).map((c) => c.hostname)].filter(Boolean).map((h) => String(h).toLowerCase());
  if (hosts.includes(low)) return null;
  return n;
}

export const UNNAMED = 'Unnamed site';
// The name a person gave the site; never the internal site_id ('default-site'), a license id or a hostname.
export function siteName(l: LicenseRecord, status: SiteStatus | null): string {
  return usable(l.site_name, l) ?? usable(status?.site_name, l) ?? UNNAMED;
}

// A license is in use once a controller holds it (or reported with it, before hardware IDs existed).
export const inUse = (l: LicenseRecord, status: SiteStatus | null) => !!l.claimed_by || !!status;

export function connectorsText(l: LicenseRecord, all: LicenseRecord[], used: number | null): string {
  if (l.connector_limit === 0) return used === null ? 'Unlimited connectors' : `${used} ${used === 1 ? 'connector' : 'connectors'} · unlimited`;
  const cap = effectiveLimit(l, all);
  return used === null ? `Up to ${cap} ${cap === 1 ? 'connector' : 'connectors'}` : `${used} of ${cap} connectors`;
}

export function termText(l: LicenseRecord): string {
  if (!l.expires_at) return 'Never expires';
  const d = new Date(l.expires_at);
  const when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return d.getTime() > Date.now() ? `Valid until ${when}` : `Expired ${when}`;
}

// What the client-side controls of a site need (no token, no e-mail).
export type SiteInfo = {
  id: string;
  name: string | null;
  hostname: string | null;
  controllerShort: string | null;
  offlineAllowed: boolean;
  copies: { controller_id: string; hostname: string; first_seen: string; decision?: string }[];
  movedAway: { until: string }[];
};

export function siteInfo(l: LicenseRecord, name: string | null, now = Date.now()): SiteInfo {
  return {
    id: l.id, name, hostname: l.claimed_hostname ?? null,
    controllerShort: l.claimed_by ? l.claimed_by.slice(0, 8) : null, offlineAllowed: l.offline_allowed === true,
    copies: (l.copies ?? []).map((c) => ({ controller_id: c.controller_id, hostname: c.hostname, first_seen: c.first_seen, decision: c.decision })),
    movedAway: (l.retired ?? []).filter((r) => r.reason === 'moved' && new Date(r.until).getTime() > now).map((r) => ({ until: r.until })),
  };
}

export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 90) return 'moments ago';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

const ups = (n: number) => `${n} ${n === 1 ? 'UPS' : 'UPSes'}`;

// The status of a tile: a word (Guarded = online, every UPS on mains), a detail, and both as one line.
// Offline never shows the last UPS reading (it would be stale).
export type Line = { word: string; detail: string; text: string; tone: SiteTone };
const mk = (word: string, detail: string, tone: SiteTone, head = word): Line => ({ word, detail, tone, text: `${head} · ${detail}` });

export function statusLine(status: SiteStatus | null, now = Date.now()): Line {
  if (!status) return { word: 'Waiting', detail: 'for the first contact', tone: 'offline', text: 'Waiting for the first contact' };
  if (!isOnline(status, now)) return mk('Offline', `last seen ${ago(status.received_at, now)}`, 'offline');
  const withUps = status.devices.filter((d) => d.ups_status);
  const count = (label: string) => withUps.filter((d) => power(d.ups_status).label === label).length;
  const low = count('Low battery'), onBat = count('On battery'), replace = count('Replace battery');
  if (low) return mk('Low battery', ups(low), 'danger');
  if (onBat) return mk('On battery', ups(onBat), 'warn');
  if (replace) return mk('Replace battery', ups(replace), 'warn');
  const down = status.devices.filter((d) => d.state !== 'online').length;
  if (down) return mk('Attention', `${down} ${down === 1 ? 'connector' : 'connectors'} offline`, 'warn', 'Online');
  if (withUps.length) return mk('Guarded', `${ups(withUps.length)} on mains`, 'ok', 'Online');
  return mk('Online', 'no UPS data yet', 'ok');
}

// Only what the page shows. Full license records (token, e-mail, site_id) and the controller's raw report
// (its own site_name, LAN addresses, device readings) never go into the rendered page or its payload.
export type CardLicense = { id: string; plan: LicenseRecord['plan']; status: LicenseRecord['status']; capacity: number; details: string };
export type SiteCard = {
  license: CardLicense; name: string; model: string | null; online: boolean; line: Line;
  power: ReturnType<typeof last24h>; info: SiteInfo;
};
export type UnusedLicense = { id: string; plan: LicenseRecord['plan']; connectors: string; term: string; founderRoot: boolean };
export type AccountView = { sites: SiteCard[]; unused: UnusedLicense[]; now: number };

// withStatus: the site licenses with their last heartbeat, as sitesWithStatus() returns them; all: every license of the
// account (for the connector add-ons).
export function accountView(withStatus: { lic: LicenseRecord; status: SiteStatus | null }[], all: LicenseRecord[], now = Date.now()): AccountView {
  const sites: SiteCard[] = [];
  const unused: UnusedLicense[] = [];
  for (const { lic, status } of withStatus) {
    if (lic.plan === 'addon_connector') continue;
    if (!inUse(lic, status)) {
      unused.push({ id: lic.id, plan: lic.plan, connectors: connectorsText(lic, all, null), term: termText(lic), founderRoot: lic.plan === 'founder' && !lic.minted_from });
      continue;
    }
    const name = siteName(lic, status);
    const online = isOnline(status, now);
    sites.push({
      license: {
        id: lic.id, plan: lic.plan, status: lic.status, capacity: effectiveLimit(lic, all),
        details: `${connectorsText(lic, all, status && online ? status.devices.length : null)} · ${termText(lic)}`,
      },
      name, model: status?.model || null, online, line: statusLine(status, now),
      power: last24h(status?.power, now), info: siteInfo(lic, name === UNNAMED ? null : name, now),
    });
  }
  return { sites, unused, now };
}
