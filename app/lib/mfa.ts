// CLOUD-MFA: two-step sign-in for PowerGuardian Cloud accounts (authenticator app, RFC 6238 TOTP) with 10 one-time
// recovery codes. Passkeys are a separate follow-up (MFA-PASSKEYS-PLAN.md).
//
// Storage: KV mfa:<email> = { v, totp: AES-GCM(secret) bound to the email, created_at, last_step,
//          recovery: HMAC of each unused code, recovery_created_at }.
// The secret is encrypted with a key derived for this purpose only (app/lib/keys); recovery codes are stored as keyed
// hashes. Neither is ever logged. A code (time step) is accepted once.
import qrcode from 'qrcode-generator';
import { kvGet, kvPut, kvDel } from '@/app/lib/kv';
import { aesKey, hmacKey, b64u, unb64u } from '@/app/lib/keys';
import { getLicensesByEmail } from '@/app/lib/license-db';
import { rateLimited } from '@/app/lib/ratelimit';

export const ISSUER = 'PowerGuardian';
const STEP_S = 30;
const enc = new TextEncoder();

// ---- base32 (RFC 4648, no padding)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function unbase32(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c); if (i < 0) throw new Error('base32');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Uint8Array.from(out);
}

// ---- TOTP (RFC 6238: HMAC-SHA1, 30 s, 6 digits)
export async function totpAt(secret: Uint8Array, step: number, digits = 6): Promise<string> {
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new Uint8Array(8);
  let c = step;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length - 1] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const stepOf = (nowMs: number) => Math.floor(nowMs / 1000 / STEP_S);

// The time step the code belongs to (now, or one step either side for clock drift), only if newer than lastStep.
export async function matchTotp(secret: Uint8Array, code: string, nowMs: number, lastStep = 0): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepOf(nowMs);
  for (const s of [now, now - 1, now + 1]) {
    if (s <= lastStep) continue;
    if (timingSafeEqual(await totpAt(secret, s), code)) return s;
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function newSecret(): Uint8Array {
  const b = new Uint8Array(20); crypto.getRandomValues(b); return b;
}

export function otpauthUri(email: string, secretB32: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${ISSUER}&algorithm=SHA1&digits=6&period=${STEP_S}`;
}

// "ABCD EFGH …": easier to type by hand.
export const groupKey = (b32: string) => b32.replace(/(.{4})/g, '$1 ').trim();

// QR code as a self-contained SVG (one path, white quiet zone), for inline use.
export function qrSvg(text: string, px = 200): string {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), m = 4, size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR code for your authenticator app"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ---- secret at rest: AES-GCM, bound to the account (AAD = email)
export async function sealSecret(email: string, secret: Uint8Array): Promise<string> {
  const key = await aesKey('pg mfa totp secret v1');
  if (!key) throw new Error('mfa: no key configured');
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(email.toLowerCase()) }, key, secret as BufferSource);
  return `${b64u(iv)}.${b64u(ct)}`;
}
export async function openSecret(email: string, sealed: string): Promise<Uint8Array | null> {
  const key = await aesKey('pg mfa totp secret v1');
  const [iv, ct] = sealed.split('.');
  if (!key || !iv || !ct) return null;
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) as BufferSource, additionalData: enc.encode(email.toLowerCase()) }, key, unb64u(ct) as BufferSource));
  } catch { return null; }
}

// ---- recovery codes: 10 × "xxxxx-xxxxx" (base32, 50 bits each), stored as HMAC(email:code)
export const RECOVERY_COUNT = 10;
const normRecovery = (s: string) => s.toLowerCase().replace(/[^a-z2-7]/g, '');
export function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_COUNT }, () => {
    const b = new Uint8Array(7); crypto.getRandomValues(b);
    const s = base32(b).toLowerCase().slice(0, 10);
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}
async function hashRecovery(email: string, code: string): Promise<string> {
  const key = await hmacKey('pg mfa recovery v1');
  if (!key) throw new Error('mfa: no key configured');
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(email.toLowerCase() + ':' + normRecovery(code))));
}
export async function hashRecoveryCodes(email: string, codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => hashRecovery(email, c)));
}

// ---- the record
export type MfaRecord = {
  v: 1;
  totp: string;               // sealed secret
  created_at: string;
  last_step: number;          // last accepted time step (a code works once)
  recovery: string[];         // hashes of unused recovery codes
  recovery_created_at: string;
};
const keyOf = (email: string) => `mfa:${email.toLowerCase()}`;

export async function getMfa(email: string): Promise<MfaRecord | null> {
  const raw = await kvGet(keyOf(email));
  if (!raw) return null;
  try { const r = JSON.parse(raw) as MfaRecord; return r && r.totp ? r : null; } catch { return null; }
}
export const saveMfa = (email: string, rec: MfaRecord) => kvPut(keyOf(email), JSON.stringify(rec));
export const deleteMfa = (email: string) => kvDel(keyOf(email));

// Turn on: the code proves the person has the secret in an app. Returns the recovery codes (shown once) or null.
export async function enableMfa(email: string, secret: Uint8Array, code: string, nowMs = Date.now()): Promise<string[] | null> {
  const step = await matchTotp(secret, cleanCode(code), nowMs);
  if (step === null) return null;
  const codes = newRecoveryCodes();
  const now = new Date(nowMs).toISOString();
  await saveMfa(email, { v: 1, totp: await sealSecret(email, secret), created_at: now, last_step: step,
    recovery: await hashRecoveryCodes(email, codes), recovery_created_at: now });
  return codes;
}

// Digits only when it looks like a 6-digit code ("123 456" pasted from an app); otherwise left for the recovery check.
export function cleanCode(input: unknown): string {
  const s = typeof input === 'string' ? input.trim() : '';
  const digits = s.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits) ? digits : s;
}

// Check an authenticator code or a recovery code against the account and record its use. Never throws on bad input.
export async function redeemCode(email: string, input: unknown, opts: { recovery?: boolean; nowMs?: number } = {}): Promise<{ ok: boolean; via?: 'totp' | 'recovery'; left?: number }> {
  const rec = await getMfa(email);
  if (!rec) return { ok: false };
  const code = cleanCode(input);
  if (/^\d{6}$/.test(code)) {
    const secret = await openSecret(email, rec.totp);
    if (!secret) return { ok: false };
    const step = await matchTotp(secret, code, opts.nowMs ?? Date.now(), rec.last_step);
    if (step === null) return { ok: false };
    await saveMfa(email, { ...rec, last_step: step });
    return { ok: true, via: 'totp', left: rec.recovery.length };
  }
  if (opts.recovery === false || normRecovery(code).length !== 10) return { ok: false };
  const h = await hashRecovery(email, code);
  const i = rec.recovery.findIndex((x) => timingSafeEqual(x, h));
  if (i < 0) return { ok: false };
  const recovery = rec.recovery.filter((_, j) => j !== i);
  await saveMfa(email, { ...rec, recovery });
  return { ok: true, via: 'recovery', left: recovery.length };
}

export async function regenerateRecovery(email: string): Promise<string[] | null> {
  const rec = await getMfa(email);
  if (!rec) return null;
  const codes = newRecoveryCodes();
  await saveMfa(email, { ...rec, recovery: await hashRecoveryCodes(email, codes), recovery_created_at: new Date().toISOString() });
  return codes;
}

// Accounts that manage sites (a licence held by a controller) must use two-step sign-in.
export async function mfaRequired(email: string): Promise<boolean> {
  const mine = await getLicensesByEmail(email);
  return mine.some((l) => l.plan !== 'addon_connector' && !!l.claimed_by && l.status !== 'revoked');
}

// Code attempts per account: 10 per 15 minutes, across sign-in and account page. Fails closed.
export async function codeAttemptsExceeded(email: string): Promise<boolean> {
  return rateLimited(`mfa:email:${email.toLowerCase()}`, 10, 900, true);
}
