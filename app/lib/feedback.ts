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
// A merged item keeps its own text, reporter and replies, with merged_into = the id it was merged into and merged_at
// (unix ms). Its reporter sees the root's status and fixed_in, their own item's replies, and of the items further up
// the chain only the replies written after the merge: a reply written to another customer before that stays private.
// Admin changes go to the root of a merge chain only, and re-read the item just before writing.
import { kvGetMany, kvList, kvListValues, kvPut } from '@/app/lib/kv';
import { rateLimited } from '@/app/lib/ratelimit';
import { readCapped } from '@/app/lib/body';

export const KINDS = ['bug', 'idea'] as const;
export type Kind = (typeof KINDS)[number];
export const STATUSES = ['new', 'seen', 'planned', 'fixed', 'rejected'] as const;
export type FbStatus = (typeof STATUSES)[number];
export const OPEN: readonly FbStatus[] = ['new', 'seen', 'planned'];

export type Reply = { at: number; text: string; ms?: number }; // at: unix s (the API's field); ms: the same, exact
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
  merged_at?: number;     // unix ms
};
// What a customer gets (GET /api/cloud/feedback and /api/account/feedback).
export type OwnItem = Pick<FeedbackItem, 'id' | 'kind' | 'text' | 'status' | 'fixed_in' | 'created_at' | 'replies'>;

export const ALL_MAX = 2000; // admin list
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

const ID_RE = /^[0-9a-f]{16}$/;
async function getItems(ids: string[]): Promise<Map<string, FeedbackItem>> {
  const vals = await kvGetMany([...new Set(ids.filter((id) => ID_RE.test(id)))].map((id) => ITEM + id));
  return new Map([...vals].map(([k, v]) => [k.slice(ITEM.length), JSON.parse(v) as FeedbackItem]));
}
export async function getItem(id: string): Promise<FeedbackItem | null> {
  return (await getItems([id])).get(id) ?? null;
}
// Loads the merge chains of `items` into `cache` (one batch read per level, a few levels at most).
async function loadChains(items: FeedbackItem[], cache: Map<string, FeedbackItem>): Promise<void> {
  let level = items;
  for (let i = 0; i < 5; i++) {
    const want = level.map((x) => x.merged_into).filter((id): id is string => !!id && !cache.has(id));
    if (!want.length) return;
    const got = await getItems(want);
    for (const [id, it] of got) cache.set(id, it);
    level = [...got.values()];
  }
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

const exact = (r: Reply) => r.ms ?? r.at * 1000;

// What the reporter of `item` sees. Along the merge chain, a reply counts only when it was written after every merge
// between `item` and the node that holds it: before that, it was meant for that node's own reporters.
export function ownView(item: FeedbackItem, byId: (id: string) => FeedbackItem | null | undefined): OwnItem {
  const replies: Reply[] = [...item.replies];
  let cur = item, since = 0;
  const seen = new Set([item.id]);
  while (cur.merged_into && !seen.has(cur.merged_into)) {
    const next = byId(cur.merged_into);
    if (!next) break;
    since = Math.max(since, cur.merged_at ?? Infinity); // an old merge without merged_at shows nothing further up
    replies.push(...next.replies.filter((r) => exact(r) >= since));
    seen.add(next.id);
    cur = next;
  }
  return {
    id: item.id, kind: item.kind, text: item.text, status: cur.status,
    ...(cur.status === 'fixed' && cur.fixed_in ? { fixed_in: cur.fixed_in } : {}),
    created_at: item.created_at, replies: replies.sort((a, b) => exact(a) - exact(b)).map((r) => ({ at: r.at, text: r.text })),
  };
}

// The account's own items, newest first, at most 50. Only keys under this account's own prefix are read.
export async function listOwn(email: string): Promise<OwnItem[]> {
  const ids = (await kvList(acctPrefix(email), LIST_MAX)).map((k) => k.slice(k.lastIndexOf(':') + 1));
  const cache = await getItems(ids);
  const mine = ids.map((id) => cache.get(id)).filter((x): x is FeedbackItem => !!x && x.email === email.toLowerCase());
  await loadChains(mine, cache);
  return mine.map((it) => ownView(it, (id) => cache.get(id)));
}

// ------------------------------------------------------------------ admin

// Every item (at most ALL_MAX; truncated says when there are more), in one read where the store allows it.
export async function listAll(): Promise<{ items: FeedbackItem[]; truncated: boolean }> {
  const { entries, truncated } = await kvListValues(ITEM, ALL_MAX);
  return { items: entries.map(([, v]) => JSON.parse(v) as FeedbackItem), truncated };
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

type Result = { ok: true; item: FeedbackItem } | { ok: false; status: number; error: string };

// The root of `item`'s merge chain, read from the store.
async function rootFromStore(item: FeedbackItem): Promise<FeedbackItem> {
  const cache = new Map([[item.id, item]]);
  await loadChains([item], cache);
  return rootOf(item, (id) => cache.get(id));
}

// Applies one admin action to the root of `id`'s merge chain. The item to change is read again just before the write
// and only this action's change is applied to that copy; a merge is refused when its target has been merged meanwhile.
export async function applyAdminAction(id: string, a: AdminAction): Promise<Result> {
  const item = await getItem(id);
  if (!item) return { ok: false, status: 404, error: 'not_found' };
  const root = await rootFromStore(item);

  if (a.action === 'merge') {
    const target = await getItem(a.into);
    if (!target) return { ok: false, status: 404, error: 'target_not_found' };
    const into = await rootFromStore(target);
    if (into.id === root.id) return { ok: false, status: 400, error: 'same_item' };
    if (into.kind !== root.kind) return { ok: false, status: 400, error: 'other_kind' };
    const [freshInto, fresh] = [await getItem(into.id), await getItem(root.id)];
    if (!freshInto || freshInto.merged_into) return { ok: false, status: 409, error: 'target_merged' };
    if (!fresh || fresh.merged_into) return { ok: false, status: 409, error: 'already_merged' };
    const next = { ...fresh, merged_into: into.id, merged_at: Date.now() };
    await putItem(next);
    return { ok: true, item: next };
  }

  const fresh = await getItem(root.id);
  if (!fresh || fresh.merged_into) return { ok: false, status: 409, error: 'changed' }; // merged meanwhile: try again
  let next: FeedbackItem;
  switch (a.action) {
    case 'reply': {
      const ms = Date.now();
      next = { ...fresh, replies: [...fresh.replies, { at: Math.floor(ms / 1000), ms, text: a.text }], ...(fresh.status === 'new' ? { status: 'seen' as const } : {}) };
      break;
    }
    case 'fixed': next = withStatus(fresh, 'fixed', a.fixed_in); break;
    default: next = withStatus(fresh, STATUS_OF[a.action]);
  }
  await putItem(next);
  return { ok: true, item: next };
}
