// PASSKEYS-1: browser side of passkeys (login page, account page). The server sends options as JSON with base64url
// strings; navigator.credentials wants bytes, and the answer goes back as base64url JSON. public/mfa-passkey.js is the
// same for the server-rendered two-step page (no bundler there).
const unb64u = (s: string): ArrayBuffer => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const b64u = (b: ArrayBuffer | null | undefined): string | null => {
  if (!b) return null;
  const u = new Uint8Array(b); let s = '';
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function' && !!navigator.credentials?.get;
}

export async function conditionalSupported(): Promise<boolean> {
  try {
    const P = window.PublicKeyCredential as unknown as { isConditionalMediationAvailable?: () => Promise<boolean> };
    return passkeySupported() && typeof P.isConditionalMediationAvailable === 'function' && await P.isConditionalMediationAvailable();
  } catch { return false; }
}

// A passkey on this device itself (Face ID, Touch ID, Windows Hello, Android screen lock).
export async function platformPasskey(): Promise<boolean> {
  try { return passkeySupported() && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

type Json = Record<string, unknown>;
const creds = (list: unknown) => (Array.isArray(list) ? list : []).map((c: Json) => ({ type: 'public-key' as const, id: unb64u(String(c.id)) }));

export function creationFromJson(o: Json): CredentialCreationOptions {
  const user = o.user as Json;
  return {
    publicKey: {
      ...(o as object),
      challenge: unb64u(String(o.challenge)),
      user: { id: unb64u(String(user.id)), name: String(user.name), displayName: String(user.displayName) },
      excludeCredentials: creds(o.excludeCredentials),
    } as PublicKeyCredentialCreationOptions,
  };
}

export function requestFromJson(o: Json, extra: { mediation?: CredentialMediationRequirement; signal?: AbortSignal } = {}): CredentialRequestOptions {
  return {
    ...extra,
    publicKey: { ...(o as object), challenge: unb64u(String(o.challenge)), allowCredentials: creds(o.allowCredentials) } as PublicKeyCredentialRequestOptions,
  };
}

export function credentialJson(c: Credential | null): Json | null {
  const pk = c as PublicKeyCredential | null;
  if (!pk || !pk.rawId) return null;
  const r = pk.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  const response: Json = { clientDataJSON: b64u(r.clientDataJSON) };
  if ('attestationObject' in r && r.attestationObject) {
    response.attestationObject = b64u(r.attestationObject);
    try { response.transports = r.getTransports?.() ?? []; } catch { /* optional */ }
  } else {
    response.authenticatorData = b64u(r.authenticatorData);
    response.signature = b64u(r.signature);
    response.userHandle = b64u(r.userHandle);
  }
  return { id: pk.id, rawId: b64u(pk.rawId), type: pk.type, response };
}

// "Safari on iPhone": the default name of a new passkey when the provider is not known from its AAGUID.
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /Android/.test(ua) ? 'Android' : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return dev && br ? `${dev} · ${br}` : dev || br || 'This device';
}

// A cancelled or timed-out browser dialog (not an error worth shouting about).
export const cancelled = (e: unknown) => e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError');

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Json }> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { message: 'No connection. Try again.' } };
  }
}

// ---- "this device has a passkey for that address" (the login page skips the e-mail for it)
// localStorage pg_pk = [hint, …]: hint = sha256 of the lower-case address with a fixed prefix (app/lib/passkeys.ts
// passkeyHint makes the same on the server). Only this device ever compares it: the server never says whether an address
// has a passkey, so nobody can probe addresses. The e-mail itself is not stored on the device.
const HINT_KEY = 'pg_pk'
const HINT_RE = /^[0-9a-f]{64}$/
export async function hintOf(email: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pg passkey hint|' + email.trim().toLowerCase()))
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
function readHints(): string[] {
  try { const a = JSON.parse(localStorage.getItem(HINT_KEY) ?? '[]'); return Array.isArray(a) ? a.filter((h) => typeof h === 'string' && HINT_RE.test(h)) : [] } catch { return [] }
}
export function saveHint(hint: unknown, on = true) {
  if (typeof hint !== 'string' || !HINT_RE.test(hint)) return
  try {
    const rest = readHints().filter((h) => h !== hint)
    const next = on ? [hint, ...rest].slice(0, 5) : rest
    if (next.length) localStorage.setItem(HINT_KEY, JSON.stringify(next)); else localStorage.removeItem(HINT_KEY)
  } catch { /* private mode */ }
}
export async function hasHint(email: string): Promise<boolean> {
  const hints = readHints()
  if (!hints.length || !email.includes('@')) return false
  try { return hints.includes(await hintOf(email)) } catch { return false }
}
