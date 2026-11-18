// FEEDBACK-1: "Problem" (kind bug) and "Idea" (kind idea) from customers, sent from the controller (Settings →
// Feedback, license token), from /account and from /feedback (session). Replies go through this channel only, never by
// e-mail. A customer only ever sees the items of their own account (the license owner's e-mail, or the session's).
//
// Key layout (app/lib/kv → the D1 table kv(key, value, expires_at); none of these keys expire):
//   feedback:item:<id>                         JSON FeedbackItem (below). The one record; everything else points here.
//                                              Nightly read: SELECT key, value FROM kv WHERE key LIKE 'feedback:item:%'
//   feedback:acct:<email>:<inv>:<id>           value <id>: the account's own list. <email> is encodeURIComponent of the
//                                              lower-case address; <inv> = 9999999999999 - the time sent (unix ms,
//                                              13 digits), so a prefix listing is newest first.
//   rl:feedback:lic:<license id>:<window>      rate limit, 10 per license per 24 h (app/lib/ratelimit, with a TTL)
//   rl:feedback:acct:<email>:<window>          rate limit, 10 per account per 24 h
// A merged item keeps its own text and reporter, with merged_into = the id it was merged into; its reporter sees that
// item's status, fixed_in and replies. Admin changes go to the root of a merge chain only.
import { kvGet, kvList, kvPut } from '@/app/lib/kv';
import { rateLimited } from '@/app/lib/ratelimit';
import { readCapped } from '@/app/lib/body';

export const KINDS = ['bug', 'idea'] as const;
export type Kind = (typeof KINDS)[number];
export const STATUSES = ['new', 'seen', 'planned', 'fixed', 'rejected'] as const;
export type FbStatus = (typeof STATUSES)[number];
export const OPEN: readonly FbStatus[] = ['new', 'seen', 'planned'];

export type Reply = { at: number; text: string };
export type FeedbackItem = {
  id: string;
  kind: Kind;
  text: string;
  status: FbStatus;
  fixed_in?: string;
  version?: string;
  report_id?: string;     // an encrypted problem report the controller sent through its own pipeline: the id only
  email: string;          // the account
  source: 'controller' | 'web';
  license_id?: string;
  created_at: number;     // unix s
  replies: Reply[];
  merged_into?: string;
};
// What a customer gets (GET /api/cloud/feedback and /api/account/feedback).
export type OwnItem = Pick<FeedbackItem, 'id' | 'kind' | 'text' | 'status' | 'fixed_in' | 'created_at' | 'replies'>;

export const MAX_BODY = 16 * 1024;
export const MAX_TEXT = 4000;
export const MAX_REPLY = 4000;
export const PER_DAY = 10;
const LIST_MAX = 50;
const ITEM = 'feedback:item:';
const acctPrefix = (email: string) => `feedback:acct:${encodeURIComponent(email.toLowerCase())}:`;

// Text keeps its line breaks and tabs; other control characters go.
const plain = (v: string) => v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim();
const oneLine = (v: string) => v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
const VERSION_RE = /^[0-9A-Za-z.+~_-]{1,32}$/;
const REPORT_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type Input = { kind: Kind; text: string; version?: string; report_id?: string };
export type Parsed = { ok: true; value: Input } | { ok: false; field: string; error: string };

// controller: version is required and report_id may be sent; from the website version is optional and report_id is
// ignored (only a controller sends problem reports).
export function parseFeedback(b: unknown, controller: boolean): Parsed {
  const body = (b && typeof b === 'object' && !Array.isArray(b) ? b : {}) as Record<string, unknown>;
  if (!(KINDS as readonly unknown[]).includes(body.kind)) return { ok: false, field: 'kind', error: 'Choose Problem or Idea.' };
  const text = typeof body.text === 'string' ? plain(body.text) : '';
  if (!text) return { ok: false, field: 'text', error: 'Write a few words first.' };
  if (text.length > MAX_TEXT) return { ok: false, field: 'text', error: `Keep it under ${MAX_TEXT} characters.` };
  const value: Input = { kind: body.kind as Kind, text };
  if (body.version !== undefined || controller) {
    if (typeof body.version !== 'string' || oneLine(body.version).length > 32) return { ok: false, field: 'version', error: 'Invalid version.' };
    const v = oneLine(body.version);
    if (v && !VERSION_RE.test(v)) return { ok: false, field: 'version', error: 'Invalid version.' };
    if (v) value.version = v;
  }
  if (controller && body.report_id !== undefined && body.report_id !== '') {
    if (typeof body.report_id !== 'string' || !REPORT_RE.test(body.report_id)) return { ok: false, field: 'report_id', error: 'Invalid report id.' };
    value.report_id = body.report_id;
  }
  return { ok: true, value };
}

export type Answer = { status: number; body: Record<string, unknown> };
export type Reporter = { email: string; source: FeedbackItem['source']; license_id?: string; bucket: string };

const newId = () => {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

// The whole POST: size cap, JSON, validation, the daily limit (per license or account: who.bucket), then store.
export async function submitFeedback(request: Request, who: Reporter): Promise<Answer> {
  const raw = await readCapped(request, MAX_BODY).catch(() => '');
  if (raw === null) return { status: 413, body: { error: 'too_large' } };
  let b: unknown = null;
  try { b = JSON.parse(raw); } catch { /* answered below as invalid input */ }
  const p = parseFeedback(b, who.source === 'controller');
  if (!p.ok) return { status: 400, body: { error: 'invalid', field: p.field, message: p.error } };
  if (await rateLimited(who.bucket, PER_DAY, 86_400)) return { status: 429, body: { error: 'rate_limited' } };

  const now = Date.now();
  const item: FeedbackItem = {
    id: newId(), ...p.value, status: 'new', email: who.email.toLowerCase(), source: who.source,
    ...(who.license_id ? { license_id: who.license_id } : {}), created_at: Math.floor(now / 1000), replies: [],
  };
  try {
    await putItem(item);
    await kvPut(`${acctPrefix(item.email)}${String(9_999_999_999_999 - now).padStart(13, '0')}:${item.id}`, item.id);
  } catch (err) {
    console.error('[feedback] not stored:', err instanceof Error ? err.message : 'error');
    return { status: 503, body: { error: 'unavailable' } };
  }
  return { status: 200, body: { id: item.id } };
}

export async function getItem(id: string): Promise<FeedbackItem | null> {
  if (!/^[0-9a-f]{16}$/.test(id)) return null;
  const v = await kvGet(ITEM + id);
  return v ? (JSON.parse(v) as FeedbackItem) : null;
}
const putItem = (item: FeedbackItem) => kvPut(ITEM + item.id, JSON.stringify(item));

// Where a merged item ends up (a chain is followed a few steps; a broken or circular one stops where it is).
export function rootOf(item: FeedbackItem, byId: (id: string) => FeedbackItem | null | undefined): FeedbackItem {
  let cur = item;
  const seen = new Set([item.id]);
  while (cur.merged_into && !seen.has(cur.merged_into)) {
    const next = byId(cur.merged_into);
    if (!next) break;
    seen.add(next.id);
    cur = next;
  }
  return cur;
}

export const ownView = (item: FeedbackItem, root: FeedbackItem): OwnItem => ({
  id: item.id, kind: item.kind, text: item.text, status: root.status,
  ...(root.status === 'fixed' && root.fixed_in ? { fixed_in: root.fixed_in } : {}),
  created_at: item.created_at, replies: root.replies,
});

// The account's own items, newest first, at most 50. Only keys under this account's own prefix are read.
export async function listOwn(email: string): Promise<OwnItem[]> {
  const keys = await kvList(acctPrefix(email), LIST_MAX);
  const mine = (await Promise.all(keys.map((k) => getItem(k.slice(k.lastIndexOf(':') + 1)))))
    .filter((x): x is FeedbackItem => !!x && x.email === email.toLowerCase());
  const cache = new Map<string, FeedbackItem | null>();
  for (const it of mine) cache.set(it.id, it);
  const out: OwnItem[] = [];
  for (const it of mine) {
    // fetch the merge chain first (rootOf itself is synchronous)
    let cur: FeedbackItem | null = it;
    for (let i = 0; i < 5 && cur?.merged_into; i++) {
      if (!cache.has(cur.merged_into)) cache.set(cur.merged_into, await getItem(cur.merged_into));
      cur = cache.get(cur.merged_into) ?? null;
    }
    out.push(ownView(it, rootOf(it, (id) => cache.get(id))));
  }
  return out;
}

// ------------------------------------------------------------------ admin

export async function listAll(): Promise<FeedbackItem[]> {
  const keys = await kvList(ITEM);
  const all = await Promise.all(keys.map((k) => getItem(k.slice(ITEM.length))));
  return all.filter((x): x is FeedbackItem => !!x);
}

export type AdminRow = FeedbackItem & { count: number; customers: number; versions: string[]; reports: string[] };

// One row per root item: the number of reports (1 + merged into it), distinct customers, and the versions and report
// ids of all of them. Newest first.
export function adminRows(all: FeedbackItem[]): AdminRow[] {
  const byId = new Map(all.map((x) => [x.id, x]));
  const groups = new Map<string, FeedbackItem[]>();
  for (const it of all) {
    const r = rootOf(it, (id) => byId.get(id)).id;
    groups.set(r, [...(groups.get(r) ?? []), it]);
  }
  return [...groups.entries()]
    .map(([id, members]) => {
      const root = byId.get(id)!;
      const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
      return { ...root, count: members.length, customers: uniq(members.map((m) => m.email)).length, versions: uniq(members.map((m) => m.version)), reports: uniq(members.map((m) => m.report_id)) };
    })
    .sort((a, b) => b.created_at - a.created_at);
}

export type AdminAction =
  | { action: 'reply'; text: string }
  | { action: 'merge'; into: string }
  | { action: 'seen' | 'plan' | 'reject' }
  | { action: 'fixed'; fixed_in: string };

export function parseAdminAction(b: unknown): AdminAction | null {
  const body = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
  switch (body.action) {
    case 'reply': {
      const text = typeof body.text === 'string' ? plain(body.text) : '';
      return text && text.length <= MAX_REPLY ? { action: 'reply', text } : null;
    }
    case 'merge': return typeof body.into === 'string' ? { action: 'merge', into: body.into } : null;
    case 'seen': case 'plan': case 'reject': return { action: body.action };
    case 'fixed': {
      const v = typeof body.fixed_in === 'string' ? oneLine(body.fixed_in) : '';
      return v === '' || VERSION_RE.test(v) ? { action: 'fixed', fixed_in: v } : null;
    }
  }
  return null;
}

const STATUS_OF = { seen: 'seen', plan: 'planned', reject: 'rejected' } as const;
// A new status; fixed_in only stays with a fixed item.
function withStatus(item: FeedbackItem, status: FbStatus, fixedIn = ''): FeedbackItem {
  const next: FeedbackItem = { ...item, status };
  delete next.fixed_in;
  if (fixedIn) next.fixed_in = fixedIn;
  return next;
}

// Applies one admin action to the root of `id`'s merge chain. Returns the changed root, or an error.
export async function applyAdminAction(id: string, a: AdminAction): Promise<{ ok: true; item: FeedbackItem } | { ok: false; status: number; error: string }> {
  const item = await getItem(id);
  if (!item) return { ok: false, status: 404, error: 'not_found' };
  const all = a.action === 'merge' || item.merged_into ? await listAll() : [item];
  const byId = new Map(all.map((x) => [x.id, x]));
  const root = rootOf(item, (x) => byId.get(x));
  let next: FeedbackItem;
  switch (a.action) {
    case 'reply': next = { ...root, replies: [...root.replies, { at: Math.floor(Date.now() / 1000), text: a.text }], ...(root.status === 'new' ? { status: 'seen' as const } : {}) }; break;
    case 'fixed': next = withStatus(root, 'fixed', a.fixed_in); break;
    case 'merge': {
      const target = byId.get(a.into);
      if (!target) return { ok: false, status: 404, error: 'target_not_found' };
      const into = rootOf(target, (x) => byId.get(x));
      if (into.id === root.id) return { ok: false, status: 400, error: 'same_item' };
      if (into.kind !== root.kind) return { ok: false, status: 400, error: 'other_kind' };
      next = { ...root, merged_into: into.id };
      break;
    }
    default: next = withStatus(root, STATUS_OF[a.action]);
  }
  await putItem(next);
  return { ok: true, item: next };
}
