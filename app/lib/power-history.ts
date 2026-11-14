// ACCOUNT-UI: 24-hour power history of a site, for the bar on its tile in "My sites".
//
// Kept inside the site's status record (sitestatus:<id>), which every heartbeat already reads and writes — no extra
// KV operations. 48 slots of 30 minutes; the last slot is the one the last heartbeat fell in. One character per slot:
//   '-' no heartbeat in that slot (offline, or before the first heartbeat) — nothing is invented for it
//   'n' online, no UPS data       'm' every UPS on mains       'b' a UPS on battery (or low battery)
// A slot keeps the worst state seen in it (b > m > n > -).
import { power } from '@/app/lib/site-summary';
import type { SiteDevice } from '@/app/lib/site-status';

export const SLOT_MS = 30 * 60_000;
export const SLOTS = 48;
export type PowerHistory = { at: number; s: string }; // at = slot number (ms / SLOT_MS) of the last character
export type Slot = '-' | 'n' | 'm' | 'b';

const RANK: Record<Slot, number> = { '-': 0, n: 1, m: 2, b: 3 };
const EMPTY = '-'.repeat(SLOTS);
const valid = (h: unknown): h is PowerHistory =>
  !!h && typeof h === 'object' && Number.isInteger((h as PowerHistory).at) && typeof (h as PowerHistory).s === 'string' && /^[-nmb]{48}$/.test((h as PowerHistory).s);

// What one heartbeat says about power.
export function slotOf(devices: SiteDevice[]): Slot {
  const levels = devices.filter((d) => d.ups_status).map((d) => power(d.ups_status).level);
  if (levels.length === 0) return 'n';
  if (levels.some((l) => l === 'danger') || devices.some((d) => /\bOB\b/i.test(d.ups_status))) return 'b';
  return 'm';
}

// The history moved to slot `to`: slots that passed without a heartbeat become '-'.
function shift(h: PowerHistory | null | undefined, to: number): string {
  if (!valid(h)) return EMPTY;
  const by = to - h.at;
  if (by <= 0) return h.s;
  if (by >= SLOTS) return EMPTY;
  return h.s.slice(by) + '-'.repeat(by);
}

// The history after a heartbeat with these devices at `now`.
export function recordBeat(prev: PowerHistory | null | undefined, devices: SiteDevice[], now = Date.now()): PowerHistory {
  const at = Math.floor(now / SLOT_MS);
  const s = shift(prev, at);
  const cur = s[SLOTS - 1] as Slot, next = slotOf(devices);
  return { at, s: s.slice(0, -1) + (RANK[next] > RANK[cur] ? next : cur) };
}

// The last 24 hours up to now, oldest first. Slots after the last heartbeat are '-' (no data), never a stale state.
export function last24h(h: PowerHistory | null | undefined, now = Date.now()): { slots: Slot[]; empty: boolean } {
  const s = shift(h, Math.floor(now / SLOT_MS));
  return { slots: s.split('') as Slot[], empty: s === EMPTY };
}
