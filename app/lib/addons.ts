import { createLicense, deleteLicense, getLicenses, updateLicense } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';
import { deleteSiteStatus, getSiteStatus } from '@/app/lib/site-status';
import { addonsOf, isRunning } from '@/app/lib/limits';

export type AddonResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; message: string };

const fail = (status: number, error: string, message: string): AddonResult<never> => ({ ok: false, status, error, message });

// Extra connectors for ONE site: a separate license that points at the site's
// license and carries its own end date.
export async function createAddon(input: {
  parent_id: string; connectors: number; expires_at: string | null; notes?: string;
}): Promise<AddonResult<LicenseRecord>> {
  if (!Number.isInteger(input.connectors) || input.connectors < 1 || input.connectors > 1000) {
    return fail(400, 'invalid_connectors', 'Connectors must be a whole number from 1 to 1000.');
  }
  const all = await getLicenses();
  const parent = all.find((l) => l.id === input.parent_id);
  if (!parent || parent.plan === 'addon_connector') return fail(404, 'parent_not_found', 'That site license does not exist.');
  if (parent.status === 'revoked') return fail(409, 'parent_revoked', 'This site’s license is revoked. Reactivate it before adding connectors.');
  if (parent.connector_limit === 0) return fail(409, 'unlimited', 'This site already has unlimited connectors.');

  const created = await createLicense({
    email: parent.email, plan: 'addon_connector', site_id: parent.site_id, parent_id: parent.id,
    connector_limit: input.connectors, expires_at: input.expires_at, notes: input.notes ?? '',
  });
  await updateLicense(parent.id, { addon_ids: [...(parent.addon_ids ?? []), created.id] });
  return { ok: true, value: created };
}

// Removing an add-on must not leave the site over its limit: refuse while more
// connectors report than would remain, and say exactly how many. Never cascades.
export async function deleteAddon(id: string): Promise<AddonResult<{ removed: string }>> {
  const all = await getLicenses();
  const addon = all.find((l) => l.id === id);
  if (!addon) return fail(404, 'not_found', 'No such license.');
  if (addon.plan !== 'addon_connector') return fail(400, 'not_an_addon', 'Only connector add-ons can be removed here. Site licenses go with their tenant.');

  const parent = all.find((l) => l.id === addon.parent_id);
  if (parent && parent.connector_limit > 0 && isRunning(addon)) {
    const remaining = parent.connector_limit + addonsOf(parent, all).filter((a) => a.id !== addon.id && isRunning(a)).reduce((n, a) => n + a.connector_limit, 0);
    const used = (await getSiteStatus(parent.id))?.devices.length ?? 0;
    if (used > remaining) {
      return fail(409, 'in_use', `${used} connectors are in use on this site but only ${remaining} would remain. Remove ${used - remaining} connector${used - remaining === 1 ? '' : 's'} first, or let this add-on expire instead.`);
    }
  }
  await deleteLicense(id);
  if (parent) await updateLicense(parent.id, { addon_ids: (parent.addon_ids ?? []).filter((x) => x !== id) });
  return { ok: true, value: { removed: id } };
}

// Deletes ONE site: its license, its stored status and its connector add-ons
// (they only exist for that site). Refused while the license still runs, so a
// customer is never cut off by accident — revoke it or let it expire first —
// and the site's name must be typed back. The tenant itself stays.
export async function deleteSite(id: string, confirm: unknown): Promise<AddonResult<{ removed: number }>> {
  const all = await getLicenses();
  const site = all.find((l) => l.id === id);
  if (!site) return fail(404, 'not_found', 'No such site.');
  if (site.plan === 'addon_connector') return fail(400, 'is_addon', 'That is a connector add-on, not a site.');
  if (isRunning(site)) return fail(409, 'in_use', 'This site’s license is still running — revoke it or let it expire first.');

  const status = await getSiteStatus(site.id);
  const expected = status?.site_name ?? 'delete';
  if (typeof confirm !== 'string' || confirm.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return fail(400, 'confirmation_mismatch', `Type “${expected}” to confirm.`);
  }

  const addons = addonsOf(site, all);
  for (const a of addons) await deleteLicense(a.id);
  await deleteSiteStatus(site.id);
  await deleteLicense(site.id);
  return { ok: true, value: { removed: 1 + addons.length } };
}
