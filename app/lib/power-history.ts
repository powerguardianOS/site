// ACCOUNT-UI: 24-hour power history of a site, for the battery strip on its tile in "My sites".
//
// Kept inside the site's status record (sitestatus:<id>), which every heartbeat already reads and writes — no extra
// KV operations. 48 slots of 30 minutes; the last slot is the one the last heartbeat fell in. One character per slot:
//   '-' no heartbeat in that slot (offline, or before the first heartbeat) — nothing is invented for it
//   'n' online, no UPS data       'm' every UPS on mains       'b' a UPS on battery (or low battery)
// A slot keeps the worst state seen in it (b > m > n > -). `m` counts the minutes on battery per slot (0–30, one
// base-32 digit each), from the time between heartbeats; records from before it simply have no minutes.
import { power } from '@/app/lib/site-summary';
import type { SiteDevice } from '@/app/lib/site-status';

export const SLOT_MS = 30 * 60_000;
export const SLOTS = 48;
export type PowerHistory = { at: number; s: string; m?: string }; // at = slot number (ms / SLOT_MS) of the last character
export type Slot = '-' | 'n' | 'm' | 'b';

export const RANK: Record<Slot, number> = { '-': 0, n: 1, m: 2, b: 3 };
const EMPTY = '-'.repeat(SLOTS), ZERO = '0'.repeat(SLOTS);
const valid = (h: unknown): h is PowerHistory =>
  !!h && typeof h === 'object' && Number.isInteger((h as PowerHistory).at) && typeof (h as PowerHistory).s === 'string' && /^[-nmb]{48}$/.test((h as PowerHistory).s);
const validM = (m: unknown): m is string => typeof m === 'string' && /^[0-9a-v]{48}$/.test(m);

// What one heartbeat says about power.
export function slotOf(devices: SiteDevice[]): Slot {
  const levels = devices.filter((d) => d.ups_status).map((d) => power(d.ups_status).level);
  if (levels.length === 0) return 'n';
  if (levels.some((l) => l === 'danger') || devices.some((d) => /\bOB\b/i.test(d.ups_status))) return 'b';
  return 'm';
}

// The history moved to slot `to`: slots that passed without a heartbeat become '-' (and 0 minutes).
function shift(h: PowerHistory | null | undefined, to: number): { s: string; m: string } {
  if (!valid(h)) return { s: EMPTY, m: ZERO };
  const m = validM(h.m) ? h.m : ZERO;
  const by = to - h.at;
  if (by <= 0) return { s: h.s, m };
  if (by >= SLOTS) return { s: EMPTY, m: ZERO };
  return { s: h.s.slice(by) + '-'.repeat(by), m: m.slice(by) + '0'.repeat(by) };
}

// The history after a heartbeat with these devices at `now`. lastAt: when the previous heartbeat came in (ms), for the
// battery minutes; a long gap counts as one minute (we do not know what happened in between).
export function recordBeat(prev: PowerHistory | null | undefined, devices: SiteDevice[], now = Date.now(), lastAt?: number): PowerHistory {
  const at = Math.floor(now / SLOT_MS);
  const { s, m } = shift(prev, at);
  const cur = s[SLOTS - 1] as Slot, next = slotOf(devices);
  let min = parseInt(m[SLOTS - 1], 32);
  if (next === 'b') {
    const gap = lastAt && now > lastAt ? (now - lastAt) / 60_000 : 1;
    min = Math.min(30, min + (gap <= 3 ? Math.max(1, Math.round(gap)) : 1));
  }
  return { at, s: s.slice(0, -1) + (RANK[next] > RANK[cur] ? next : cur), m: m.slice(0, -1) + min.toString(32) };
}

// ---- HIST-24H: the controller's own summary (power_24h in its heartbeat) ----
// {v:1, state:'ups', at, s, m}: 48 half-hour slots up to slot `at` (the same slot numbers as ours: unix time / 30 min), per
// slot m (mains), b (battery) or u (the controller has no data), and the battery minutes as one base-32 digit (0–30, never 0
// for b, always 0 otherwise). {v:1, state:'no_ups'}: the controller has no UPS at all. Built from what the controller has
// stored for weeks, so the strip is right from the first heartbeat. Untrusted input: checked strictly, anything else = null.
export type ControllerPower = { state: 'ups'; at: number; s: string; m: string } | { state: 'no_ups' };
const MAX_SKEW_SLOTS = 1; // a controller clock more than one slot off: its slots would land on the wrong hours

export function parseControllerPower(v: unknown, now = Date.now()): ControllerPower | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  if (o.v !== 1) return null;
  if (o.state === 'no_ups') return keys.length === 2 ? { state: 'no_ups' } : null;
  if (o.state !== 'ups' || keys.length !== 5 || !['v', 'state', 'at', 's', 'm'].every((k) => k in o)) return null;
  const { at, s, m } = o;
  if (typeof at !== 'number' || !Number.isSafeInteger(at) || Math.abs(at - Math.floor(now / SLOT_MS)) > MAX_SKEW_SLOTS) return null;
  if (typeof s !== 'string' || typeof m !== 'string' || !/^[mbu]{48}$/.test(s) || !/^[0-9a-u]{48}$/.test(m)) return null;
  for (let i = 0; i < SLOTS; i++) if ((s[i] === 'b') !== (m[i] !== '0')) return null;
  return { state: 'ups', at, s, m };
}

// The cloud's history with the controller's summary on top: for every slot the controller knows (m or b) its state and
// minutes win; where it says u, or for slots outside its window, the cloud's own history stays (older controllers send
// nothing and simply keep the cloud's history).
export function applyControllerPower(h: PowerHistory, c: ControllerPower): PowerHistory {
  if (c.state !== 'ups') return h;
  const s = h.s.split(''), m = (validM(h.m) ? h.m : ZERO).split('');
  const base = h.at - (SLOTS - 1), cbase = c.at - (SLOTS - 1);
  for (let i = 0; i < SLOTS; i++) {
    const j = cbase + i - base;
    if (j < 0 || j >= SLOTS || c.s[i] === 'u') continue;
    s[j] = c.s[i]; m[j] = c.m[i];
  }
  return { at: h.at, s: s.join(''), m: m.join('') };
}

// The last 24 hours up to now, oldest first. Slots after the last heartbeat are '-' (no data), never a stale state.
export function last24h(h: PowerHistory | null | undefined, now = Date.now()): { at: number; slots: Slot[]; minutes: number[]; empty: boolean } {
  const at = Math.floor(now / SLOT_MS);
  const { s, m } = shift(h, at);
  return { at, slots: s.split('') as Slot[], minutes: m.split('').map((c) => parseInt(c, 32)), empty: s === EMPTY };
}

// ---- hour cells (shared by the tile and its tests) ----
export type HourCell = { start: number; end: number; current: boolean; fill: number; state: Slot; minutes: number | null; label: string };
const STATE_LABEL: Record<Slot, string> = { m: 'On mains', b: 'On battery', n: 'Online, no UPS data', '-': 'No data' };

// 24 cells on clock hours, the last one the current hour (filled as far as it has run). hourStart(t) gives the start of
// t's hour in the viewer's time zone; fmt(t) its "13:00". Pure, so the browser runs it with local time and tests with any.
export function hourCells(
  p: { at: number; slots: Slot[]; minutes: number[] }, now: number,
  hourStart: (t: number) => number, fmt: (t: number) => string,
): HourCell[] {
  const base = p.at - (SLOTS - 1); // slot number of slots[0]
  const h0 = hourStart(now);
  const cells: HourCell[] = [];
  for (let j = 0; j < 24; j++) {
    const start = h0 - (23 - j) * 3_600_000, end = start + 3_600_000, current = j === 23;
    let state: Slot = '-', min = 0, known = true;
    for (let t = start; t < Math.min(end, now + 1); t += SLOT_MS) {
      const i = Math.floor(t / SLOT_MS) - base;
      if (i < 0 || i >= SLOTS) continue;
      const s = p.slots[i];
      if (RANK[s] > RANK[state]) state = s;
      if (s === 'b') { if (p.minutes[i] > 0) min += p.minutes[i]; else known = false; }
    }
    const minutes = state === 'b' && known && min > 0 ? min : null;
    const range = `${fmt(start)}–${current ? 'now' : fmt(end)}`;
    const label = `${range} · ${STATE_LABEL[state]}${minutes ? ` ${minutes} min` : ''}`;
    cells.push({ start, end, current, fill: current ? Math.max(0.08, Math.min(1, (now - start) / 3_600_000)) : 1, state, minutes, label });
  }
  return cells;
}
