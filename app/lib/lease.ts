// The 30-day lease: a small signed statement that "this license may run on this
// controller until <date>". Controllers and connectors verify the signature
// themselves and enforce the date offline. Ed25519 via Web Crypto (Workers + Node).

export const LEASE_DAYS = 30;
export const DAY_S = 86_400;

export type LeaseState = 'licensed' | 'unconfirmed_copy' | 'moved' | 'offline';

export type LeasePayload = {
  v: 1;
  license_id: string;
  controller_id: string;
  plan: string;
  connector_limit: number; // effective; 0 = unlimited
  issued_at: number;       // unix seconds
  valid_until: number;     // unix seconds
  site_name: string | null;
  state: LeaseState;
  offline?: boolean;
  notice?: string;
};

const enc = new TextEncoder();
const bytes = (s: string): Uint8Array<ArrayBuffer> => fromBin(unescape(encodeURIComponent(s)));
const b64u = (b: ArrayBuffer | Uint8Array): string => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBin = (bin: string): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const unb64u = (s: string): Uint8Array<ArrayBuffer> => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return fromBin(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad));
};
const unb64 = (s: string): Uint8Array<ArrayBuffer> => fromBin(atob(s));

export function leaseConfigured(): boolean {
  return !!process.env.LEASE_PRIVATE_KEY;
}

// Returns null when no signing key is configured: callers then simply do not
// hand out a lease, and controllers stay on the old, unenforced behaviour.
export async function signLease(p: LeasePayload): Promise<string | null> {
  const k = process.env.LEASE_PRIVATE_KEY;
  if (!k) return null;
  const key = await crypto.subtle.importKey('pkcs8', unb64(k.trim()), { name: 'Ed25519' }, false, ['sign']);
  const body = b64u(enc.encode(JSON.stringify(p)));
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, bytes(body));
  return `${body}.${b64u(sig)}`;
}

export async function verifyLease(token: string, publicKeyRawB64: string): Promise<LeasePayload | null> {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  try {
    const key = await crypto.subtle.importKey('raw', unb64(publicKeyRawB64), { name: 'Ed25519' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, unb64u(token.slice(dot + 1)), bytes(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(body))) as LeasePayload;
    return p && p.v === 1 ? p : null;
  } catch {
    return null;
  }
}
