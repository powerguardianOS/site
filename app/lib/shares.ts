// SHARE-1 (data model only, not wired to any route or page yet): an owner shares ONE site with another person by e-mail,
// like Meraki. Design: SHARE-1-PLAN.md. The rules that keep tenants apart live here, in one place:
//   - a share names exactly one site licence (site_id) and one invitee e-mail; it never covers another site of the owner,
//     the licences, billing or account settings (siteAccess / canManageLicence below are the only decisions);
//   - only the licence owner invites and revokes; a shared-with person can never re-share (not even an "admin" share);
//   - an invitation is accepted only by the invited mailbox (signed-in e-mail must equal it) with the one-time invite token,
//     stored hashed; it expires after 7 days; accepting a token for site A never yields site B;
//   - a revoked or expired share decides nothing: siteAccess answers null, the same as for a stranger;
//   - every console opening is audited per site (logConsoleAccess), so the owner sees who opened which console when.
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { getLicense, type LicenseRecord } from '@/app/lib/license-db';
import { logAudit } from '@/app/lib/audit';

export type ShareRole = 'viewer' | 'admin';
export type Share = {
  site_id: string;
  owner_email: string;          // the licence owner at invite time; re-checked against the licence on every decision
  email: string;                // the invitee (lower case)
  role: ShareRole;
  state: 'invited' | 'active' | 'revoked';
  invite_hash: string | null;   // sha256 of the one-time invite token; null once accepted
  invited_at: string;
  invite_expires_at: string;
  accepted_at?: string;
  revoked_at?: string;
  expires_at?: string | null;   // optional end of the share itself
};
export type Access = { role: 'owner' | ShareRole; via: 'licence' | 'share' };
type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export const INVITE_TTL_MS = 7 * 86_400_000;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$|^[^\s@]{1,64}@[a-z0-9-]{1,63}$/;
const key = (siteId: string, email: string) => `share:${siteId}:${email.toLowerCase()}`;
const byEmail = (email: string) => `shares:by-email:${email.toLowerCase()}`;
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const fail = (status: number, error: string) => ({ ok: false as const, status, error });

async function readShare(siteId: string, email: string): Promise<Share | null> {
  const raw = await kvGet(key(siteId, email));
  try { return raw ? JSON.parse(raw) as Share : null; } catch { return null; }
}
async function indexAdd(email: string, siteId: string) {
  const raw = await kvGet(byEmail(email)); const ids: string[] = raw ? JSON.parse(raw) : [];
  if (!ids.includes(siteId)) await kvPut(byEmail(email), JSON.stringify([...ids, siteId]));
}

// The site licence when `email` is its owner (an active site licence, not an add-on), else null.
async function ownedSite(email: string, siteId: string): Promise<LicenseRecord | null> {
  const l = await getLicense(siteId);
  if (!l || l.plan === 'addon_connector' || l.status !== 'active') return null;
  return l.email.toLowerCase() === email.toLowerCase() ? l : null;
}

// THE decision: what may `email` do on this one site? null = nothing (a stranger, a revoked or expired share, another site).
export async function siteAccess(email: string, siteId: string, now = Date.now()): Promise<Access | null> {
  if (!email || !siteId) return null;
  const l = await getLicense(siteId);
  if (!l || l.plan === 'addon_connector' || l.status !== 'active') return null;
  if (l.email.toLowerCase() === email.toLowerCase()) return { role: 'owner', via: 'licence' };
  const s = await readShare(siteId, email);
  if (!s || s.state !== 'active' || s.site_id !== siteId || s.email !== email.toLowerCase()) return null;
  if (s.owner_email.toLowerCase() !== l.email.toLowerCase()) return null; // the licence changed hands: old shares die with it
  if (s.expires_at && new Date(s.expires_at).getTime() <= now) return null;
  return { role: s.role, via: 'share' };
}

// Licences, billing, moving/releasing a controller, account settings and sharing itself: the owner only, never a share.
export async function canManageLicence(email: string, siteId: string): Promise<boolean> {
  return (await siteAccess(email, siteId))?.role === 'owner';
}

// The sites a person reaches through shares (for a future "Shared with me" list): only active, unexpired, still-valid ones.
export async function sharedSites(email: string, now = Date.now()): Promise<{ site_id: string; role: ShareRole }[]> {
  const raw = await kvGet(byEmail(email)); const ids: string[] = raw ? JSON.parse(raw) : [];
  const out: { site_id: string; role: ShareRole }[] = [];
  for (const id of ids) { const a = await siteAccess(email, id, now); if (a && a.via === 'share') out.push({ site_id: id, role: a.role as ShareRole }); }
  return out;
}

export async function inviteShare(owner: string, siteId: string, invitee: unknown, role: unknown, opts: { expires_at?: string | null } = {}, now = Date.now()): Promise<Result<{ token: string; share: Share }>> {
  if (!(await ownedSite(owner, siteId))) return fail(404, 'not_found'); // never reveal another tenant's site
  const email = typeof invitee === 'string' ? invitee.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 320) return fail(400, 'bad_email');
  if (email === owner.toLowerCase()) return fail(400, 'self');
  if (role !== 'viewer' && role !== 'admin') return fail(400, 'bad_role');
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const share: Share = {
    site_id: siteId, owner_email: owner.toLowerCase(), email, role, state: 'invited', invite_hash: await sha256(token),
    invited_at: new Date(now).toISOString(), invite_expires_at: new Date(now + INVITE_TTL_MS).toISOString(),
    expires_at: opts.expires_at ?? null,
  };
  await kvPut(key(siteId, email), JSON.stringify(share));
  await indexAdd(email, siteId);
  await logAudit({ actor: owner.toLowerCase(), role: 'owner', action: 'share.invite', email: owner.toLowerCase(), license_id: siteId, detail: `${email} as ${role}` });
  return { ok: true, value: { token, share } };
}

// The invitee, signed in with the invited address, accepts with the token from the mail.
export async function acceptShare(signedInEmail: string, siteId: string, token: unknown, now = Date.now()): Promise<Result<Share>> {
  const email = signedInEmail.toLowerCase();
  const s = await readShare(siteId, email);
  if (!s || s.state !== 'invited' || !s.invite_hash || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return fail(404, 'not_found');
  if (new Date(s.invite_expires_at).getTime() <= now) return fail(410, 'invite_expired');
  if ((await sha256(token)) !== s.invite_hash) return fail(404, 'not_found');
  const l = await getLicense(siteId);
  if (!l || l.email.toLowerCase() !== s.owner_email) return fail(404, 'not_found');
  const next: Share = { ...s, state: 'active', invite_hash: null, accepted_at: new Date(now).toISOString() };
  await kvPut(key(siteId, email), JSON.stringify(next));
  await logAudit({ actor: email, role: 'owner', action: 'share.accept', email: s.owner_email, license_id: siteId, detail: `${email} as ${s.role}` });
  return { ok: true, value: next };
}

export async function revokeShare(owner: string, siteId: string, invitee: string, now = Date.now()): Promise<Result<Share>> {
  if (!(await ownedSite(owner, siteId))) return fail(404, 'not_found');
  const s = await readShare(siteId, invitee);
  if (!s) return fail(404, 'not_found');
  const next: Share = { ...s, state: 'revoked', invite_hash: null, revoked_at: new Date(now).toISOString() };
  await kvPut(key(siteId, invitee), JSON.stringify(next));
  await logAudit({ actor: owner.toLowerCase(), role: 'owner', action: 'share.revoke', email: owner.toLowerCase(), license_id: siteId, detail: invitee.toLowerCase() });
  return { ok: true, value: next };
}

export async function deleteShare(owner: string, siteId: string, invitee: string): Promise<boolean> {
  if (!(await ownedSite(owner, siteId))) return false;
  await kvDel(key(siteId, invitee));
  return true;
}

// Every console opening (portal, site switcher, later a share), per site: who, how, when. Shown to the site's owner.
export async function logConsoleAccess(actor: string, siteId: string, via: 'portal' | 'switcher' | 'share' | 'reopen', ownerEmail: string): Promise<void> {
  await logAudit({ actor: actor.toLowerCase(), role: 'owner', action: 'console.open', email: ownerEmail.toLowerCase(), license_id: siteId, detail: via });
}
