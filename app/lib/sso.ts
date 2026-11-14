// CLOUD-SSO: "Sign in with PowerGuardian Cloud" on a controller. The browser comes here from the controller with
// (controller id, nonce, return address); the account signs in as usual; this side checks the account owns the site of
// that controller and sends the browser back with a short statement signed with the lease key. The controller checks
// it with the lease public key it already trusts (controller/sso.go).
//
// The signed bytes start with "pgsso1." so a statement can never pass as a lease (signed bytes = the bare body).
import { signWithLeaseKey } from '@/app/lib/lease';
import { getLicensesByEmail, type LicenseRecord } from '@/app/lib/license-db';

export const SSO_PREFIX = 'pgsso1.';
export const SSO_CALLBACK_PATH = '/api/auth/sso/callback';
export const SSO_TTL_S = 60;

export type SSOAssertion = {
  v: 1; typ: 'sso';
  sub: string; email: string;
  controller_id: string; site_id: string; site_name: string;
  role: 'admin';
  nonce: string; aud: string;
  iat: number; exp: number;
  // CLOUD-MFA: present (true) only when the cloud session behind this statement passed two-step sign-in. The controller
  // then skips its own authenticator step for this sign-in; without it the controller asks it as before.
  mfa?: true;
};

const CTRL_RE = /^[0-9a-f]{64}$/;
const NONCE_RE = /^[0-9a-f]{16,128}$/;
const RELAY_HOST_RE = /^(relay|console)\.powerguardian\.cloud$|^[a-z0-9-]{1,63}\.console\.powerguardian\.cloud$/;

function privateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// The address the browser may be sent back to: only the controller's callback on a LAN address (private IPv4, a
// .local name or a single-label host name) or on the PowerGuardian console host. Returns the origin, or null.
export function ssoReturnOrigin(ret: string): string | null {
  let u: URL;
  try { u = new URL(ret); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== SSO_CALLBACK_PATH) return null;
  const host = u.hostname.toLowerCase();
  if (RELAY_HOST_RE.test(host)) return u.port ? null : `https://${host}`;
  const lan = privateIPv4(host) || /^[a-z0-9-]{1,63}\.local$/.test(host) || /^[a-z0-9-]{1,63}$/.test(host);
  return lan ? `https://${u.host.toLowerCase()}` : null;
}

export type SSORequest = { controller: string; nonce: string; ret: string; origin: string };

export function parseSSORequest(p: URLSearchParams): SSORequest | null {
  const controller = (p.get('controller') ?? '').toLowerCase();
  const nonce = (p.get('nonce') ?? '').toLowerCase();
  const ret = p.get('return') ?? '';
  const origin = ssoReturnOrigin(ret);
  if (!CTRL_RE.test(controller) || !NONCE_RE.test(nonce) || !origin) return null;
  return { controller, nonce, ret, origin };
}

// The site licence of this account that the controller holds, or null: no statement for anyone else's controller.
export async function ssoSiteFor(email: string, controller: string): Promise<LicenseRecord | null> {
  const mine = await getLicensesByEmail(email);
  return mine.find((l) => l.plan !== 'addon_connector' && l.claimed_by === controller) ?? null;
}

export async function signSSO(a: SSOAssertion): Promise<string | null> {
  const body = btoa(unescape(encodeURIComponent(JSON.stringify(a)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const msg = SSO_PREFIX + body;
  const sig = await signWithLeaseKey(msg);
  return sig ? `${msg}.${sig}` : null;
}

export function buildAssertion(email: string, site: LicenseRecord, req: SSORequest, now = Math.floor(Date.now() / 1000), mfa = false): SSOAssertion {
  // TODO(team roles): members of a site get their own role here; today only the licence owner signs in, as admin.
  return {
    v: 1, typ: 'sso', sub: 'email:' + email.toLowerCase(), email: email.toLowerCase(),
    controller_id: req.controller, site_id: site.id, site_name: site.site_name ?? '', role: 'admin',
    nonce: req.nonce, aud: req.origin, iat: now, exp: now + SSO_TTL_S,
    ...(mfa ? { mfa: true as const } : {}),
  };
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function ssoHtml(status: number, title: string, body: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)} · PowerGuardian</title>` +
    `<body style="margin:0;background:#0b0f17;color:#e6edf3;font-family:system-ui,-apple-system,sans-serif">` +
    `<main style="max-width:440px;margin:0 auto;padding:48px 20px"><h1 style="font-size:22px;margin:0 0 16px">${esc(title)}</h1>${body}</main></body></html>`,
    // Referrer-Policy same-origin, NOT no-referrer: with no-referrer browsers send "Origin: null" on the Continue form
    // POST, and the POST needs the real Origin to prove it came from this page.
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" } },
  );
}
