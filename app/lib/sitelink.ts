// Linking a controller to a site, and deciding what a heartbeat is.
// Pure rules live here (decideHeartbeat); the claim functions read and write KV.

import { getLicenses, getLicense, rotateTokenKeepOld, updateLicense } from '@/app/lib/license-db';
import type { LicenseRecord, Retired } from '@/app/lib/license-db';
import { getSiteStatus, isOnline } from '@/app/lib/site-status';
import { effectiveLimit, isRunning, limitFor } from '@/app/lib/limits';
import { DAY_S, LEASE_DAYS, signLease } from '@/app/lib/lease';
import type { LeaseState } from '@/app/lib/lease';
import { logAudit } from '@/app/lib/audit';

const DAY = 86_400_000;
export const COOLDOWN_DAYS = 30;
const UNDO_WINDOW_MS = 3_600_000;

// ---------------------------------------------------------------- KV (tickets)

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () => `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;

export type Ticket = { email: string; controller_id: string; hostname: string; created: number };

const randomHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

export async function createTicket(email: string, controller_id: string, hostname: string): Promise<string> {
  const id = randomHex(24);
  const t: Ticket = { email: email.toLowerCase(), controller_id, hostname, created: Date.now() };
  await fetch(`${BASE()}/values/${encodeURIComponent(`claim:${id}`)}?expiration_ttl=600`, {
    method: 'PUT', headers: { Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' }, body: JSON.stringify(t),
  });
  return id;
}

export async function readTicket(id: string): Promise<Ticket | null> {
  if (!/^[0-9a-f]{48}$/.test(id)) return null;
  const r = await fetch(`${BASE()}/values/${encodeURIComponent(`claim:${id}`)}`, { headers: { Authorization: `Bearer ${CF_TOKEN()}` } });
  if (!r.ok) return null;
  try { return JSON.parse(await r.text()) as Ticket; } catch { return null; }
}

export async function burnTicket(id: string): Promise<void> {
  await fetch(`${BASE()}/values/${encodeURIComponent(`claim:${id}`)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${CF_TOKEN()}` } });
}

// ------------------------------------------------------------------- choices

export type SiteChoice = {
  license_id: string;
  name: string | null;
  plan: string;
  connector_limit: number;
  expires_at: string | null;
  state: 'free' | 'yours' | 'in_use';
  can_transfer: boolean;
  transfer_blocked?: string;
  holder?: { hostname: string | null; online: boolean; last_seen: number | null };
};

const lastMoveBlock = (l: LicenseRecord, controller_id: string, now: number): string | undefined => {
  // Undo: the controller that was just replaced may take its site straight back.
  const undo = (l.retired ?? []).some((r) => r.reason === 'moved' && r.controller_id === controller_id && now - new Date(r.at).getTime() < UNDO_WINDOW_MS);
  if (undo) return undefined;
  if (l.moved_at) {
    const left = new Date(l.moved_at).getTime() + COOLDOWN_DAYS * DAY - now;
    if (left > 0) return `This license was moved recently. It can move again in ${Math.ceil(left / DAY)} day${Math.ceil(left / DAY) === 1 ? '' : 's'}.`;
  }
  return undefined;
};

export async function listChoices(email: string, controller_id: string, now = Date.now()): Promise<SiteChoice[]> {
  const all = await getLicenses();
  const mine = all.filter((l) => l.email.toLowerCase() === email.toLowerCase() && l.plan !== 'addon_connector' && isRunning(l, now))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const out: SiteChoice[] = [];
  for (const l of mine) {
    const status = await getSiteStatus(l.id);
    const holderKnown = !!l.claimed_by || !!status; // a legacy controller (no hardware ID yet) still holds the site
    const state: SiteChoice['state'] = l.claimed_by === controller_id ? 'yours' : holderKnown ? 'in_use' : 'free';
    const block = state === 'in_use' ? lastMoveBlock(l, controller_id, now) : undefined;
    out.push({
      license_id: l.id, name: l.site_name ?? status?.site_name ?? null, plan: l.plan,
      connector_limit: effectiveLimit(l, all, now), expires_at: l.expires_at, state,
      can_transfer: state === 'in_use' && !block, transfer_blocked: block,
      holder: state === 'in_use' ? { hostname: l.claimed_hostname ?? null, online: isOnline(status, now), last_seen: status?.received_at ?? null } : undefined,
    });
  }
  // The unassigned license comes first: it is the default choice.
  const rank = { free: 0, yours: 1, in_use: 2 } as const;
  return out.sort((a, b) => rank[a.state] - rank[b.state]);
}

// --------------------------------------------------------------------- claim

export type ClaimResult =
  | { ok: true; token: string; license: LicenseRecord; moved_from?: string | null }
  | { ok: false; status: number; error: string; message: string };

const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) : '');

export async function claimSite(
  t: Ticket, licenseId: string, opts: { name?: unknown; transfer?: unknown; acknowledge?: unknown }, now = Date.now(),
): Promise<ClaimResult> {
  const l = await getLicense(licenseId);
  if (!l || l.email.toLowerCase() !== t.email || l.plan === 'addon_connector') {
    return { ok: false, status: 404, error: 'site_not_found', message: 'That site does not exist for this account.' };
  }
  if (!isRunning(l, now)) return { ok: false, status: 409, error: 'not_active', message: 'This site’s license is not active.' };

  const name = clean(opts.name);
  const patch: Partial<LicenseRecord> = {};
  if (name) patch.site_name = name;
  const stamp = new Date(now).toISOString();
  const status = await getSiteStatus(l.id);
  const heldByOther = (!!l.claimed_by && l.claimed_by !== t.controller_id) || (!l.claimed_by && !!status);

  let token = l.token;
  let movedFrom: string | null | undefined;

  if (!heldByOther) {
    patch.claimed_by = t.controller_id;
    patch.claimed_hostname = t.hostname;
    patch.claimed_at = l.claimed_by === t.controller_id ? l.claimed_at : stamp;
  } else {
    if (opts.transfer !== true || opts.acknowledge !== true) {
      return { ok: false, status: 409, error: 'needs_transfer', message: 'This site runs on another controller. Moving it needs an explicit confirmation.' };
    }
    const block = lastMoveBlock(l, t.controller_id, now);
    if (block) return { ok: false, status: 429, error: 'cooldown', message: block };

    const undo = (l.retired ?? []).some((r) => r.reason === 'moved' && r.controller_id === t.controller_id && now - new Date(r.at).getTime() < UNDO_WINDOW_MS);
    const expiry = l.expires_at ? new Date(l.expires_at).getTime() : Infinity;
    const until = new Date(Math.min(now + (undo ? 0 : COOLDOWN_DAYS * DAY), expiry)).toISOString();
    const rot = await rotateTokenKeepOld(l.id);
    if (!rot) return { ok: false, status: 404, error: 'site_not_found', message: 'That site does not exist for this account.' };
    token = rot.next;
    movedFrom = l.claimed_hostname ?? null;
    const retired: Retired = { controller_id: l.claimed_by ?? null, token: rot.old, until, reason: 'moved', at: stamp };
    patch.retired = [...(l.retired ?? []).filter((r) => !(undo && r.controller_id === t.controller_id)), retired];
    patch.claimed_by = t.controller_id;
    patch.claimed_hostname = t.hostname;
    patch.claimed_at = stamp;
    patch.moved_at = undo ? undefined : stamp;
    // A controller that claims a site is no longer an unconfirmed copy anywhere.
  }

  const updated = await updateLicense(l.id, patch);
  if (!updated) return { ok: false, status: 404, error: 'site_not_found', message: 'That site does not exist for this account.' };
  await logAudit({
    actor: t.email, role: 'owner', action: heldByOther ? 'site.transfer' : 'site.claim', email: t.email, license_id: l.id,
    detail: `${t.hostname || t.controller_id.slice(0, 8)}${movedFrom ? ` took over from ${movedFrom}` : ''}${name ? `, named “${name}”` : ''}`,
  });
  return { ok: true, token, license: { ...updated, token }, moved_from: movedFrom };
}

// ----------------------------------------------------------------- heartbeat

export type HbDecision =
  | { kind: 'holder'; leaseUntil: number; adopt: boolean; legacy: boolean }
  | { kind: 'copy'; leaseUntil: number; isNew: boolean; relink: boolean }
  | { kind: 'retired'; leaseUntil: number; reason: Retired['reason'] }
  | { kind: 'denied'; status: number; error: string };

// Which role does this controller have for this license? Pure, so it is tested
// without any storage. `now` and the result are unix seconds.
export function decideHeartbeat(l: LicenseRecord, token: string, controllerId: string | undefined, now: number): HbDecision {
  if (l.status === 'revoked') return { kind: 'denied', status: 403, error: 'revoked' };
  const expiry = l.expires_at ? Math.floor(new Date(l.expires_at).getTime() / 1000) : Infinity;
  if (expiry <= now) return { kind: 'denied', status: 403, error: 'expired' };
  const full = Math.min(now + LEASE_DAYS * DAY_S, expiry);

  const r = (l.retired ?? []).find((e) => (e.controller_id !== null ? e.controller_id === controllerId : e.token === token));
  if (r) {
    const until = Math.floor(new Date(r.until).getTime() / 1000);
    return until <= now ? { kind: 'denied', status: 403, error: 'retired' } : { kind: 'retired', leaseUntil: Math.min(until, expiry), reason: r.reason };
  }
  if (token !== l.token) return { kind: 'denied', status: 401, error: 'unauthorized' };

  if (!controllerId) return { kind: 'holder', leaseUntil: full, adopt: false, legacy: true };
  if (!l.claimed_by) return { kind: 'holder', leaseUntil: full, adopt: true, legacy: false };
  if (l.claimed_by === controllerId) return { kind: 'holder', leaseUntil: full, adopt: false, legacy: false };

  const c = (l.copies ?? []).find((x) => x.controller_id === controllerId);
  if (c?.decision === 'removed') return { kind: 'denied', status: 403, error: 'copy_removed' };
  const first = c ? Math.floor(new Date(c.first_seen).getTime() / 1000) : now;
  if (first + LEASE_DAYS * DAY_S <= now) return { kind: 'denied', status: 403, error: 'copy_expired' };
  return { kind: 'copy', leaseUntil: Math.min(first + LEASE_DAYS * DAY_S, expiry), isNew: !c, relink: c?.decision === 'relink' };
}

export async function leaseFor(
  l: LicenseRecord, controllerId: string, until: number, state: LeaseState, now: number, notice?: string,
): Promise<string | null> {
  return signLease({
    v: 1, license_id: l.id, controller_id: controllerId, plan: l.plan,
    connector_limit: await limitFor(l, getLicense, now * 1000), issued_at: now, valid_until: until,
    site_name: l.site_name ?? null, state, ...(notice ? { notice } : {}),
  });
}
