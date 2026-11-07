// The founder licence may link any number of controllers. Each extra controller
// gets its own site licence, "minted" from the founder licence (the root):
// plan founder, unlimited connectors, never expires, `minted_from` = root id.
//
// Rules:
// - Only the server decides who is a founder: an active, non-expired licence with
//   plan 'founder' that was not minted itself. Minting needs the e-mail code flow
//   (a claim ticket) — there is no client flag.
// - A minted site lives only while its root runs. Revoking the root revokes the
//   children (written to KV, so admin and portal show it); every check that hands
//   out access also looks at the root, so a missed write cannot keep a child alive.
// - Minting is rate limited per founder and written to the audit log.

import { createLicense, getLicense, getLicenses } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { isRunning } from '@/app/lib/limits';
import { rateLimited } from '@/app/lib/ratelimit';
import { logAudit } from '@/app/lib/audit';

export const NEW_SITE = 'new';
export const MINTS_PER_DAY = 20;

export const isFounderRoot = (l: LicenseRecord) => l.plan === 'founder' && !l.minted_from;

// The running founder licence of this e-mail, or null. The oldest wins.
export function founderRoot(email: string, all: LicenseRecord[], now = Date.now()): LicenseRecord | null {
  return all
    .filter((l) => l.email.toLowerCase() === email.toLowerCase() && isFounderRoot(l) && isRunning(l, now))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;
}

const rootOk = (l: LicenseRecord, root: LicenseRecord | null | undefined, now: number) =>
  !!root && isFounderRoot(root) && root.email.toLowerCase() === l.email.toLowerCase() && isRunning(root, now);

// Does the licence's root (if it has one) still run? Licences without a root: always true.
export function rootRunningIn(l: LicenseRecord, all: LicenseRecord[], now = Date.now()): boolean {
  if (!l.minted_from) return true;
  return rootOk(l, all.find((x) => x.id === l.minted_from), now);
}

export async function rootRunning(l: LicenseRecord, getOne: (id: string) => Promise<LicenseRecord | null> = getLicense, now = Date.now()): Promise<boolean> {
  if (!l.minted_from) return true;
  return rootOk(l, await getOne(l.minted_from), now);
}

// The licence as the access checks must see it: a child of a dead root counts as revoked.
export async function withRoot(l: LicenseRecord, getOne?: (id: string) => Promise<LicenseRecord | null>): Promise<LicenseRecord> {
  return (await rootRunning(l, getOne)) ? l : { ...l, status: 'revoked' };
}

// A site name that no other site of this tenant uses (case-insensitive): "Name", "Name 2", ...
export function uniqueSiteName(wanted: string, taken: string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  if (!used.has(wanted.toLowerCase())) return wanted;
  for (let i = 2; ; i++) {
    const n = `${wanted.slice(0, 76)} ${i}`;
    if (!used.has(n.toLowerCase())) return n;
  }
}

export type MintResult =
  | { ok: true; license: LicenseRecord }
  | { ok: false; status: number; error: string; message: string };

// Creates a new founder site for `email`, bound to this controller. Callers must
// have verified the e-mail (a claim ticket); this function checks the founder rule.
export async function mintFounderSite(
  email: string, controller: { id: string; hostname: string }, name: string, now = Date.now(),
): Promise<MintResult> {
  const all = await getLicenses();
  const root = founderRoot(email, all, now);
  if (!root) return { ok: false, status: 404, error: 'site_not_found', message: 'That site does not exist for this account.' };
  try {
    if (await rateLimited(`mint:founder:${root.id}`, MINTS_PER_DAY, 86_400, true)) {
      return { ok: false, status: 429, error: 'mint_limit', message: `At most ${MINTS_PER_DAY} new sites per day. Try again tomorrow.` };
    }
  } catch {
    return { ok: false, status: 503, error: 'unavailable', message: 'Try again in a minute.' };
  }
  const taken = all.filter((l) => l.email.toLowerCase() === email.toLowerCase() && l.plan !== 'addon_connector' && l.site_name).map((l) => l.site_name!);
  const site_name = uniqueSiteName(name || controller.hostname || 'Site', taken);
  const stamp = new Date(now).toISOString();
  const license = await createLicense({
    email: email.toLowerCase(), plan: 'founder', site_id: 'default-site', connector_limit: 0, expires_at: null,
    notes: `Founder site, added from the founder licence ${root.id}.`,
    minted_from: root.id, site_name,
    claimed_by: controller.id, claimed_hostname: controller.hostname, claimed_at: stamp,
  });
  await logAudit({
    actor: email.toLowerCase(), role: 'owner', action: 'site.mint', email: email.toLowerCase(), license_id: license.id,
    detail: `${controller.hostname || controller.id.slice(0, 8)} got a new founder site “${site_name}” (from ${root.id})`,
  });
  return { ok: true, license };
}

// After the admin changed a founder root's status: the children follow. A revoke
// marks them `revoked_with_root`, so reactivating the root brings back exactly those
// (a child the admin revoked on its own stays revoked).
export async function cascadeRootStatus(
  root: LicenseRecord, status: 'active' | 'revoked', actor: string,
  update: (id: string, patch: Partial<LicenseRecord>) => Promise<LicenseRecord | null>,
): Promise<string[]> {
  if (!isFounderRoot(root)) return [];
  const children = (await getLicenses()).filter((l) => l.minted_from === root.id);
  const changed: string[] = [];
  for (const c of children) {
    if (status === 'revoked' && c.status === 'active') {
      await update(c.id, { status: 'revoked', revoked_with_root: true });
    } else if (status === 'active' && c.status === 'revoked' && c.revoked_with_root) {
      await update(c.id, { status: 'active', revoked_with_root: undefined });
    } else continue;
    changed.push(c.id);
    await logAudit({ actor, role: 'admin', action: `license.${status === 'revoked' ? 'revoke' : 'reactivate'}`, email: c.email, license_id: c.id, detail: `follows its founder licence ${root.id}` });
  }
  return changed;
}
