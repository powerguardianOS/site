// The tester waitlist: sign-ups for the beta, invited in small groups. Stored through app/lib/kv (KV or EU D1, per
// KV_BACKEND) under the "tester:" prefix, one record per e-mail address. The first sign-up wins: a later one for the
// same address changes nothing and sends nothing, so nobody can overwrite someone else's entry.
// Nothing here creates a licence or an invitation: the admin decides.
import { kvGet, kvList, kvPut } from '@/app/lib/kv';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';
import { sendEmail } from '@/app/lib/email';
import { readCapped } from '@/app/lib/body';

export const PROTECTS = ['nas', 'servers', 'network', 'other'] as const;
export type Protect = (typeof PROTECTS)[number];
export const PROTECT_LABEL: Record<Protect, string> = { nas: 'NAS', servers: 'Servers', network: 'Network', other: 'Other' };

export type Tester = {
  email: string;
  name: string;
  country: string;
  ups: string;          // brand / model, free text
  protects: Protect[];
  ups_count: number;
  heard: string;        // how they heard of us
  consent: true;        // agreed to be contacted
  created_at: string;
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PREFIX = 'tester:';
const MAX_BODY = 8_000; // bytes; the largest valid sign-up is well under 2 KB
const key = (email: string) => PREFIX + email;

// Plain text, one line, no control characters, at most `max` characters.
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';

export type Parsed = { ok: true; value: Omit<Tester, 'created_at'> } | { ok: false; field: string; error: string };

export function parseTester(b: unknown): Parsed {
  const body = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 320) return { ok: false, field: 'email', error: 'Enter a valid e-mail address.' };
  const country = clean(body.country, 60);
  if (!country) return { ok: false, field: 'country', error: 'Enter your country.' };
  const ups = clean(body.ups, 200);
  if (!ups) return { ok: false, field: 'ups', error: 'Enter the brand and model of your UPS.' };
  const protects = Array.isArray(body.protects) ? [...new Set(body.protects)] : [];
  if (!protects.length || !protects.every((p): p is Protect => (PROTECTS as readonly unknown[]).includes(p))) {
    return { ok: false, field: 'protects', error: 'Pick at least one thing it should protect.' };
  }
  const n = Number(body.ups_count);
  if (!Number.isInteger(n) || n < 1 || n > 100) return { ok: false, field: 'ups_count', error: 'How many UPSes: a number from 1 to 100.' };
  if (body.consent !== true) return { ok: false, field: 'consent', error: 'Please agree that we may contact you.' };
  return {
    ok: true,
    value: { email: rawEmail.toLowerCase(), name: clean(body.name, 100), country, ups, protects: protects as Protect[], ups_count: n, heard: clean(body.heard, 200), consent: true },
  };
}

export type SignUp = { status: number; body: Record<string, unknown> };

// The confirmation mail is fixed text: nothing a visitor typed goes into it, so the form cannot be used to send
// someone else a message of the visitor's own from our domain.
export const CONFIRM_SUBJECT = "You're on the PowerGuardian tester waitlist";
export const CONFIRM_TEXT = `Hi,\n\nThanks for joining the PowerGuardian tester waitlist. We invite testers in small groups and read every sign-up ourselves. We will e-mail you when it is your turn.\n\nWhat you get: PowerGuardian Pro free during the beta, and a direct line to the maker.\nWhat we ask: install it on your own hardware, tell us about your UPS and devices, and tell us what works and what does not.\n\nDid not sign up? Ignore this e-mail; we will not contact you.\n\n— PowerGuardian`;

// The whole POST /api/tester flow: JSON only, size cap, honeypot, validation, rate limits per IP and per address
// (fail closed: it sends mail), store, and the fixed confirmation mail — only for a new address.
export async function signUpTester(request: Request): Promise<SignUp> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return { status: 415, body: { ok: false, error: 'application/json required' } };
  }
  const text = await readCapped(request, MAX_BODY).catch(() => '');
  if (text === null) return { status: 413, body: { ok: false, error: 'Too much data.' } };
  let b: unknown = null;
  try { b = JSON.parse(text); } catch { /* invalid JSON: answered below as invalid input */ }
  // Honeypot: a field people never see. A bot that fills it gets the normal answer, and nothing is stored or sent.
  if (b && typeof b === 'object' && typeof (b as Record<string, unknown>).website === 'string' && (b as Record<string, string>).website.trim()) {
    return { status: 200, body: { ok: true } };
  }
  const p = parseTester(b);
  if (!p.ok) return { status: 400, body: { ok: false, field: p.field, error: p.error } };

  try {
    if (
      (await rateLimited(`tester:ip:${clientIp(request)}`, 5, 3600, true)) ||
      (await rateLimited(`tester:email:${p.value.email}`, 3, 3600, true))
    ) {
      return { status: 429, body: { ok: false, error: 'Too many requests — try again later.' } };
    }
  } catch {
    return { status: 503, body: { ok: false, error: 'Service unavailable — please try again.' } };
  }

  try {
    // Already on the list: the same answer as a new sign-up, and nothing changes (no overwrite, no mail).
    if (await getTester(p.value.email)) return { status: 200, body: { ok: true } };
    const now = new Date().toISOString();
    const rec: Tester = { ...p.value, created_at: now };
    await kvPut(key(rec.email), JSON.stringify(rec));
    await sendEmail(rec.email, CONFIRM_SUBJECT, CONFIRM_TEXT);
  } catch (err) {
    console.error('[tester] sign-up not completed:', err instanceof Error ? err.message : 'error');
    return { status: 503, body: { ok: false, error: 'Could not save your sign-up — please try again.' } };
  }
  return { status: 200, body: { ok: true } };
}

export async function getTester(email: string): Promise<Tester | null> {
  const v = await kvGet(key(email.toLowerCase()));
  return v ? (JSON.parse(v) as Tester) : null;
}

// Newest first. Listed by key prefix (no separate index that two sign-ups at once could overwrite).
export async function listTesters(): Promise<Tester[]> {
  const keys = await kvList(PREFIX);
  const all = await Promise.all(keys.map((k) => getTester(k.slice(PREFIX.length))));
  return all.filter((t): t is Tester => !!t).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// CSV with every field quoted; a cell that starts with = + - @ (or a tab/CR) is prefixed with ' so a spreadsheet
// never runs it as a formula.
export function testersCsv(list: Tester[]): string {
  const cell = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = 'signed_up,email,name,country,ups,protects,ups_count,heard,consent';
  const rows = list.map((t) => [t.created_at, t.email, t.name, t.country, t.ups, t.protects.join(' '), t.ups_count, t.heard, t.consent ? 'yes' : 'no'].map(cell).join(','));
  return [head, ...rows].join('\n') + '\n';
}
