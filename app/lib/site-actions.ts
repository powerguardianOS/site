// What an owner (or the admin) can do to a site and its controllers. Pure KV logic
// with no cookies in it, so it is tested directly. Authorisation and the e-mail
// re-confirmation happen in the API routes in front of it.

import { getLicense, getLicenses, rotateTokenKeepOld, updateLicense } from '@/app/lib/license-db';
import type { LicenseRecord, Retired } from '@/app/lib/license-db';
import { deleteSiteStatus } from '@/app/lib/site-status';
import { isRunning, limitFor } from '@/app/lib/limits';
import { signLease } from '@/app/lib/lease';
import { logAudit } from '@/app/lib/audit';
import { dateLong, notifyOwner } from '@/app/lib/notify';

export type Actor = { email: string; role: 'owner' | 'admin' };
export type ActionResult<T = Record<string, unknown>> = { ok: true; value: T } | { ok: false; status: number; error: string; message: string };
const fail = (status: number, error: string, message: string): ActionResult<never> => ({ ok: false, status, error, message });

const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) : '');
const isHexId = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{32,64}$/i.test(s);

async function mine(licenseId: string, actor: Actor): Promise<LicenseRecord | null> {
  const l = await getLicense(licenseId);
  if (!l || l.plan === 'addon_connector') return null;
  if (actor.role === 'owner' && l.email.toLowerCase() !== actor.email.toLowerCase()) return null; // never reveal other tenants
  return l;
}
const NOT_FOUND = fail(404, 'not_found', 'That site does not exist.');

export async function renameSite(licenseId: string, name: unknown, actor: Actor): Promise<ActionResult> {
  const l = await mine(licenseId, actor);
  if (!l) return NOT_FOUND;
  const n = clean(name);
  if (!n) return fail(400, 'name_required', 'Give the site a name.');
  await updateLicense(l.id, { site_name: n });
  await logAudit({ actor: actor.email, role: actor.role, action: 'site.rename', email: l.email, license_id: l.id, detail: `${l.site_name ?? '(unnamed)'} → ${n}` });
  return { ok: true, value: { site_name: n } };
}

// The copy takes the site; the old controller is retired at once (it locks at its next contact).
export async function replaceWithCopy(licenseId: string, copyId: unknown, actor: Actor, now = Date.now()): Promise<ActionResult> {
  const l = await mine(licenseId, actor);
  if (!l) return NOT_FOUND;
  const copy = l.copies?.find((c) => c.controller_id === copyId && c.decision !== 'removed');
  if (!copy) return fail(404, 'copy_not_found', 'That copy is no longer known. Reload the page.');
  if (!l.claimed_by) return fail(409, 'holder_unknown', 'The current controller has no hardware ID yet. Use the setup wizard on the new controller to take over the site.');
  const at = new Date(now).toISOString();
  const retired: Retired = { controller_id: l.claimed_by, token: null, until: at, reason: 'replaced', at };
  await updateLicense(l.id, {
    retired: [...(l.retired ?? []), retired],
    claimed_by: copy.controller_id, claimed_hostname: copy.hostname, claimed_at: at, moved_at: at,
    copies: (l.copies ?? []).filter((c) => c.controller_id !== copy.controller_id),
  });
  await logAudit({ actor: actor.email, role: actor.role, action: 'copy.replace', email: l.email, license_id: l.id, detail: `${copy.hostname || copy.controller_id.slice(0, 8)} replaced ${l.claimed_hostname || l.claimed_by.slice(0, 8)}` });
  await notifyOwner(l.email, `${l.site_name ?? 'Your site'}: controller replaced`, `${copy.hostname || 'A controller'} now runs ${l.site_name ?? 'your site'}. The previous controller${l.claimed_hostname ? ` (${l.claimed_hostname})` : ''} was retired and locks at its next contact with the cloud, or by ${dateLong(Math.floor(now / 1000) + 30 * 86400)} if it is offline. You can recycle it afterwards.\n\nIf you did not do this, contact us right away.`);
  return { ok: true, value: { replaced: l.claimed_hostname ?? null } };
}

// "Keep both": the copy must get a site license of its own. We only mark it, so its
// controller says so; the real linking happens in its setup wizard.
export async function keepCopy(licenseId: string, copyId: unknown, actor: Actor): Promise<ActionResult> {
  const l = await mine(licenseId, actor);
  if (!l) return NOT_FOUND;
  const copy = l.copies?.find((c) => c.controller_id === copyId);
  if (!copy) return fail(404, 'copy_not_found', 'That copy is no longer known. Reload the page.');
  const free = (await getLicenses()).some((x) => x.email.toLowerCase() === l.email.toLowerCase() && x.plan !== 'addon_connector' && x.id !== l.id && isRunning(x) && !x.claimed_by);
  if (!free) return fail(409, 'no_free_site', 'There is no unassigned site license. Add a site license first, then keep both.');
  await updateLicense(l.id, { copies: (l.copies ?? []).map((c) => (c.controller_id === copy.controller_id ? { ...c, decision: 'relink' as const } : c)) });
  await logAudit({ actor: actor.email, role: actor.role, action: 'copy.keep', email: l.email, license_id: l.id, detail: `${copy.hostname || copy.controller_id.slice(0, 8)} will be linked to its own site` });
  return { ok: true, value: {} };
}

export async function removeCopy(licenseId: string, copyId: unknown, actor: Actor): Promise<ActionResult> {
  const l = await mine(licenseId, actor);
  if (!l) return NOT_FOUND;
  const copy = l.copies?.find((c) => c.controller_id === copyId);
  if (!copy) return fail(404, 'copy_not_found', 'That copy is no longer known. Reload the page.');
  await updateLicense(l.id, { copies: (l.copies ?? []).map((c) => (c.controller_id === copy.controller_id ? { ...c, decision: 'removed' as const } : c)) });
  await logAudit({ actor: actor.email, role: actor.role, action: 'copy.remove', email: l.email, license_id: l.id, detail: `${copy.hostname || copy.controller_id.slice(0, 8)} switched off` });
  return { ok: true, value: {} };
}

// Frees the site for another controller. The current one is retired at once and the token is rotated.
export async function releaseSite(licenseId: string, actor: Actor, now = Date.now()): Promise<ActionResult> {
  const l = await mine(licenseId, actor);
  if (!l) return NOT_FOUND;
  const at = new Date(now).toISOString();
  const rot = await rotateTokenKeepOld(l.id);
  if (!rot) return NOT_FOUND;
  const retired: Retired = { controller_id: l.claimed_by ?? null, token: rot.old, until: at, reason: 'released', at };
  await updateLicense(l.id, { retired: [...(l.retired ?? []), retired], claimed_by: undefined, claimed_hostname: undefined, claimed_at: undefined, copies: [] });
  await deleteSiteStatus(l.id);
  await logAudit({ actor: actor.email, role: actor.role, action: 'site.release', email: l.email, license_id: l.id, detail: `${l.claimed_hostname || 'controller'} released from ${l.site_name ?? 'the site'}` });
  await notifyOwner(l.email, `${l.site_name ?? 'Your site'} was released`, `${l.site_name ?? 'Your site'} no longer belongs to a controller. The previous controller${l.claimed_hostname ? ` (${l.claimed_hostname})` : ''} stops at its next contact with the cloud. Link a controller to the site in its setup wizard.\n\nIf you did not do this, contact us right away.`);
  return { ok: true, value: {} };
}

// A 12-month lease for a site without internet, bound to one controller. Only for
// sites the admin approved (offline_allowed).
export async function issueOfflineLease(licenseId: string, controllerId: unknown, actor: Actor, now = Date.now()): Promise<ActionResult<{ lease: string; valid_until: number }>> {
  const l = await mine(licenseId, actor);
  if (!l) return NOT_FOUND;
  if (!l.offline_allowed) return fail(403, 'not_allowed', 'Offline licenses are not enabled for this site. Contact sales@powerguardian.cloud.');
  if (!isHexId(controllerId)) return fail(400, 'bad_controller_id', 'Enter the controller ID shown on the controller (Settings → License).');
  const cid = controllerId.toLowerCase();
  if (l.claimed_by && l.claimed_by !== cid) return fail(409, 'wrong_controller', 'This site is linked to another controller. Release or replace it first.');
  if (!isRunning(l, now)) return fail(409, 'not_active', 'This site’s license is not active.');
  const nowS = Math.floor(now / 1000);
  const expiry = l.expires_at ? Math.floor(new Date(l.expires_at).getTime() / 1000) : Infinity;
  const until = Math.min(nowS + 365 * 86400, expiry);
  const lease = await signLease({
    v: 1, license_id: l.id, controller_id: cid, plan: l.plan, connector_limit: await limitFor(l, getLicense, now),
    issued_at: nowS, valid_until: until, site_name: l.site_name ?? null, state: 'offline', offline: true,
  });
  if (!lease) return fail(503, 'not_configured', 'Leases are not configured yet.');
  if (!l.claimed_by) await updateLicense(l.id, { claimed_by: cid, claimed_at: new Date(now).toISOString() });
  await logAudit({ actor: actor.email, role: actor.role, action: 'lease.offline', email: l.email, license_id: l.id, detail: `12-month offline lease for ${cid.slice(0, 8)}…, ends ${dateLong(until)}` });
  await notifyOwner(l.email, `Offline lease issued for ${l.site_name ?? 'your site'}`, `An offline lease valid until ${dateLong(until)} was generated for controller ${cid.slice(0, 8)}…. Request a new file before it ends.\n\nIf you did not do this, contact us right away.`);
  return { ok: true, value: { lease, valid_until: until } };
}

export async function setSiteFlags(licenseId: string, flags: { offline_allowed?: unknown; site_name?: unknown }, actor: Actor): Promise<ActionResult> {
  const l = await mine(licenseId, actor);
  if (!l) return NOT_FOUND;
  const patch: Partial<LicenseRecord> = {};
  if (typeof flags.offline_allowed === 'boolean') patch.offline_allowed = flags.offline_allowed;
  if (flags.site_name !== undefined) { const n = clean(flags.site_name); if (n) patch.site_name = n; }
  await updateLicense(l.id, patch);
  await logAudit({ actor: actor.email, role: actor.role, action: 'site.update', email: l.email, license_id: l.id, detail: JSON.stringify(patch) });
  return { ok: true, value: {} };
}
