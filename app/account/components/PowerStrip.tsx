'use client';

// ACCOUNT-UI: the 24 h battery strip of a site tile — 24 cells on clock hours (the viewer's time zone), the last one the
// current hour, filled as far as it has run. Hover (desktop), tap (phone) or arrow keys (keyboard) show a small label
// above the strip: "13:00–14:00 · On battery 12 min". No library.
import { useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { hourCells } from '@/app/lib/power-history';
import type { Slot } from '@/app/lib/power-history';

type Props = { id: string; at: number; slots: Slot[]; minutes: number[]; empty: boolean; now: number };

const COLOR: Record<Slot, string> = { m: '#00C66F', b: '#fbbf24', n: '#71717a', '-': 'transparent' };
// Server render: UTC hours (the same on server and client, so hydration matches); after mount: the viewer's own hours.
const utcHour = (t: number) => Math.floor(t / 3_600_000) * 3_600_000;
const utcFmt = (t: number) => `${String(new Date(t).getUTCHours()).padStart(2, '0')}:00`;
const localHour = (t: number) => { const d = new Date(t); d.setMinutes(0, 0, 0); return d.getTime(); };
const noop = () => () => {};
const localFmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export default function PowerStrip({ id, at, slots, minutes, empty, now }: Props) {
  const local = useSyncExternalStore(noop, () => true, () => false); // false while hydrating, true after
  const [sel, setSel] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const cells = hourCells({ at, slots, minutes }, now, local ? localHour : utcHour, local ? localFmt : utcFmt);
  const indexAt = (x: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(23, Math.floor(((x - r.left) / r.width) * 24)));
  };
  const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse' && !pinned) setSel(indexAt(e.clientX)); };
  const onLeave = () => { if (!pinned) setSel(null); };
  const onTap = (e: MouseEvent) => {
    e.stopPropagation();
    const i = indexAt(e.clientX);
    if (pinned && sel === i) { setPinned(false); setSel(null); } else { setPinned(true); setSel(i); }
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(k)) return;
    e.preventDefault();
    if (k === 'Escape') { setSel(null); setPinned(false); return; }
    const cur = sel ?? 23;
    setPinned(true);
    setSel(k === 'Home' ? 0 : k === 'End' ? 23 : k === 'ArrowLeft' ? Math.max(0, cur - 1) : Math.min(23, cur + 1));
  };
  const label = sel === null ? '' : cells[sel].label;

  return (
    <div className="power-strip pointer-events-auto relative z-10 select-none">
      <p className="strip-label h-4 truncate text-[11px] leading-4 text-white/80" aria-live="polite">{label}</p>
      <div className="mt-1 flex items-center">
        <div ref={ref} tabIndex={0} role="listbox" id={`strip-${id}`}
          aria-label={`Power, last 24 hours${empty ? ', no history yet' : ''}. Use the arrow keys to read each hour.`}
          aria-activedescendant={sel === null ? undefined : `strip-${id}-${sel}`}
          onPointerMove={onMove} onMouseLeave={onLeave} onClick={onTap} onKeyDown={onKey}
          onBlur={() => { setSel(null); setPinned(false); }}
          className="-my-2 flex flex-1 cursor-pointer gap-[2px] rounded-[5px] py-2 outline-none focus-visible:ring-2 focus-visible:ring-[#00C66F]/60">
          <div className="flex flex-1 gap-[2px] rounded-[4px] border border-white/15 p-[2px]">
            {cells.map((c, i) => (
              <span key={i} id={`strip-${id}-${i}`} role="option" aria-selected={sel === i} aria-label={c.label} data-state={c.state}
                className={`strip-cell relative h-4 flex-1 overflow-hidden rounded-[1px] bg-white/[0.06] ${sel === i ? 'ring-1 ring-white/70' : ''}`}>
                <span className="absolute inset-y-0 left-0" style={{ width: `${c.fill * 100}%`, background: COLOR[c.state] }} />
              </span>
            ))}
          </div>
          <span className="w-[3px] self-center"><span className="block h-2 w-[3px] rounded-r-sm bg-white/15" /></span>
        </div>
      </div>
      <div className="mt-1 flex justify-between pr-[3px] text-[10px] text-white/30">
        <span>24 h ago</span>
        {empty && <span>no history yet</span>}
        <span>now</span>
      </div>
    </div>
  );
}
