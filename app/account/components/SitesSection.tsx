import type { SiteTone } from '@/app/lib/site-summary';
import { PLAN_LABEL } from '@/app/lib/account-view';
import type { AccountView, SiteCard, SitePlan, UnusedLicense } from '@/app/lib/account-view';
import type { Slot } from '@/app/lib/power-history';
import OpenConsoleButton from './OpenConsoleButton';
import SiteControls from './SiteControls';
import UnderlicensedBanner from './UnderlicensedBanner';
import { planBadge } from './ui';

// ACCOUNT-UI: "My sites" — one calm tile per site, health at a glance, details in the console. PowerGuardian's own
// look: the shield, Fraunces for names, green = Guarded.
//
// Two looks while the owner chooses (server-side switch, not visible to customers: ACCOUNT_LOOK=b, default a):
//   a  "Shield tiles": grid of tiles, status word (Guarded / On battery / Offline) and a slim 24 h power line.
//   b  "Power rows":   rows with a shield badge and a 24 h battery-cell strip (one cell per hour).
export type Look = 'a' | 'b';
export const accountLook = (): Look => (process.env.ACCOUNT_LOOK === 'b' ? 'b' : 'a');

const TONE_TEXT: Record<SiteTone, string> = { ok: 'text-[#00C66F]', warn: 'text-amber-300', danger: 'text-red-400', offline: 'text-white/40' };
const TONE_HEX: Record<SiteTone, string> = { ok: '#00C66F', warn: '#fbbf24', danger: '#f87171', offline: '#52525b' };
const SLOT_HEX: Record<Slot, string> = { m: '#00C66F', b: '#fbbf24', n: '#71717a', '-': 'transparent' };
const SLOT_TITLE: Record<Slot, string> = { m: 'on mains', b: 'on battery', n: 'online, no UPS data', '-': 'no data' };

export const planName = (plan: string) => PLAN_LABEL[plan as SitePlan] ?? plan;

function Shield({ tone, size = 18 }: { tone: SiteTone; size?: number }) {
  const c = TONE_HEX[tone];
  return (
    <svg aria-hidden="true" width={size} height={size * 140 / 128} viewBox="0 0 128 140" className="shrink-0">
      <path d="M64 8 L112 28 V72 C112 100 94 122 64 132 C34 122 16 100 16 72 V28 L64 8Z" fill={tone === 'offline' ? 'none' : `${c}1f`} stroke={c} strokeWidth="11" strokeLinejoin="round" />
      {tone !== 'offline' && <path d="M72 32 L48 72 H62 L52 108 L80 68 H66 L72 32Z" fill={c} />}
    </svg>
  );
}

// Look a: a slim power line over 24 h — high = on mains, a dip = on battery, a gap = no heartbeat.
function PowerLine({ slots, empty }: { slots: Slot[]; empty: boolean }) {
  const W = 2, Y: Record<Slot, number> = { m: 4, n: 4, b: 14, '-': 0 };
  const paths: { d: string; c: Slot }[] = [];
  slots.forEach((s, i) => {
    if (s === '-') return;
    const prev = slots[i - 1];
    const d = prev && prev !== '-' && Y[prev] !== Y[s] ? `M${i * W} ${Y[prev]} V${Y[s]} H${i * W + W}` : `M${i * W} ${Y[s]} H${i * W + W}`;
    paths.push({ d, c: s });
  });
  return (
    <div className="power-line space-y-1" data-slots={slots.join('')}>
      <svg role="img" aria-label={empty ? 'Power, last 24 hours: no history yet' : 'Power, last 24 hours'} viewBox="0 0 96 18" preserveAspectRatio="none" className="h-5 w-full overflow-visible">
        <line x1="0" x2="96" y1="9" y2="9" stroke="rgba(255,255,255,0.08)" strokeDasharray="1 2" vectorEffect="non-scaling-stroke" />
        {paths.map((p, i) => <path key={i} d={p.d} data-slot={p.c} fill="none" stroke={SLOT_HEX[p.c]} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke"><title>{SLOT_TITLE[p.c]}</title></path>)}
      </svg>
      <p className="text-[10px] tracking-wide text-white/30">{empty ? 'Power line starts with the next heartbeat' : 'Power, 24 h'}</p>
    </div>
  );
}

// Look b: 24 battery cells (one per hour, the worse of its two half hours) in a battery outline.
function PowerCells({ slots, empty }: { slots: Slot[]; empty: boolean }) {
  const rank: Record<Slot, number> = { '-': 0, n: 1, m: 2, b: 3 };
  const hours = Array.from({ length: 24 }, (_, h) => { const a = slots[h * 2], b = slots[h * 2 + 1]; return rank[a] >= rank[b] ? a : b; });
  return (
    <div className="power-cells flex items-center gap-2" data-slots={slots.join('')} role="img" aria-label={empty ? 'Power, last 24 hours: no history yet' : 'Power, last 24 hours'}>
      <div className="flex items-center">
        <div className="flex gap-[2px] rounded-[4px] border border-white/15 p-[2px]">
          {hours.map((s, i) => <span key={i} data-slot={s} title={SLOT_TITLE[s]} className="h-3 w-[5px] rounded-[1px] sm:w-1.5" style={{ background: s === '-' ? 'rgba(255,255,255,0.06)' : SLOT_HEX[s] }} />)}
        </div>
        <span className="h-1.5 w-[3px] rounded-r-sm bg-white/15" />
      </div>
      <span className="text-[10px] text-white/30">{empty ? 'no history yet' : '24 h'}</span>
    </div>
  );
}

function hintFor(site: SiteCard) {
  const lic = site.license;
  const canConsole = lic.status === 'active' && (lic.plan === 'pro' || lic.plan === 'founder');
  const hint = canConsole && !site.online ? 'The console opens when the site is online.'
    : !canConsole && lic.status === 'active' && lic.plan === 'home'
      ? <>Remote console is a Pro feature · <a href="/pricing" className="text-[#00C66F] hover:underline">Upgrade</a></> : null;
  return { clickable: canConsole && site.online, hint };
}

export function Site({ site, look }: { site: SiteCard; look: Look }) {
  const { license: lic, name, model, line } = site;
  const { clickable, hint } = hintFor(site);
  const controls = (
    <SiteControls site={site.info} title={name} details={lic.details} hint={hint}
      left={<span className={`site-plan ${planBadge(lic.plan)}`}>{planName(lic.plan)}</span>} />
  );
  const status = <p className={`site-line text-xs ${line.tone === 'ok' ? 'text-white/50' : TONE_TEXT[line.tone]}`}>{line.text}</p>;

  if (look === 'b') {
    return (
      <article className={`site-card pg-feature relative flex flex-col p-4 ${clickable ? '' : 'hover:!transform-none hover:!shadow-none'}`}
        data-license={lic.id} data-clickable={clickable ? 'yes' : 'no'} aria-label={name}>
        {clickable && <OpenConsoleButton licenseId={lic.id} name={name} />}
        <div className="pointer-events-none relative flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"><Shield tone={line.tone} size={20} /></span>
          <div className={`min-w-0 flex-1 ${clickable ? 'pr-14' : ''}`}>
            <h3 className="site-name pg-display truncate text-xl text-white">{name}</h3>
            {status}
          </div>
        </div>
        <div className="pointer-events-none relative mt-3 flex flex-wrap items-center justify-between gap-2 pl-[52px]">
          <PowerCells {...site.power} />
          <span className="site-model truncate text-[11px] text-white/35">{model ?? ''}</span>
        </div>
        <div className="relative empty:hidden"><UnderlicensedBanner connectorLimit={lic.capacity} /></div>
        {controls}
      </article>
    );
  }

  return (
    <article className={`site-card pg-feature relative flex min-h-[200px] flex-col p-5 ${clickable ? '' : 'hover:!transform-none hover:!shadow-none'}`}
      data-license={lic.id} data-clickable={clickable ? 'yes' : 'no'} aria-label={name}>
      {clickable && <OpenConsoleButton licenseId={lic.id} name={name} />}
      <div className="pointer-events-none relative">
        <h3 className={`site-name pg-display truncate text-2xl text-white ${clickable ? 'pr-16' : ''}`}>{name}</h3>
        <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${TONE_TEXT[line.tone]}`}>
          <Shield tone={line.tone} size={14} /><span className="site-word">{line.word}</span>
        </p>
        <p className="site-line mt-0.5 truncate text-xs text-white/45">{[line.detail, model].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="pointer-events-none relative mt-4"><PowerLine {...site.power} /></div>
      <div className="relative empty:hidden"><UnderlicensedBanner connectorLimit={lic.capacity} /></div>
      {controls}
    </article>
  );
}

function AddSite({ href, look }: { href: string; look: Look }) {
  return (
    <a id="add-site" href={href}
      className={`flex ${look === 'a' ? 'min-h-[96px] flex-col sm:min-h-[200px]' : 'min-h-[88px]'} items-center justify-center gap-2 rounded-[14px] border border-dashed border-white/15 p-4 text-center transition-colors hover:border-[#00C66F]/50 hover:bg-[#00C66F]/[0.03]`}>
      <span className="text-sm font-medium text-white/80">+ Add site</span>
      <span className="text-xs text-white/40">Link a controller, or get a license</span>
    </a>
  );
}

// Licenses that no controller holds yet: one quiet line, how to use them opens inline.
export function UnusedLicenses({ unused, open }: { unused: UnusedLicense[]; open?: boolean }) {
  if (unused.length === 0) return null;
  const founderRoot = unused.some((l) => l.founderRoot);
  return (
    <details id="unused-licenses" className="text-sm" open={open}>
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-white/50 hover:text-white/80 sm:min-h-0 [&::-webkit-details-marker]:hidden">
        <span>{unused.length} {unused.length === 1 ? 'license' : 'licenses'} not in use · <span className="text-[#00C66F]">How to use</span></span>
      </summary>
      <div className="mt-2 space-y-3 rounded-[14px] border border-white/10 bg-zinc-900/60 p-4 text-xs text-white/50">
        <p>
          On the controller, open <b className="font-medium text-white/80">Settings → License</b> and link it with this account’s e-mail
          address. It picks a free license by itself and shows up as a site.
          {founderRoot && ' Your Founder license covers as many controllers as you like: each one becomes its own site.'}
        </p>
        <ul className="space-y-2">
          {unused.map((l) => (
            <li key={l.id} className="unused-license flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={planBadge(l.plan)}>{planName(l.plan)}</span>
              <span className="text-white/70">{l.connectors}</span>
              <span>{l.term}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export default function SitesSection({ view, look }: { view: AccountView; look: Look }) {
  return (
    <div id="site-grid" data-look={look} className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${look === 'a' ? 'lg:grid-cols-3' : ''}`}>
      {view.sites.map((s) => <Site key={s.license.id} site={s} look={look} />)}
      <AddSite href={view.unused.length ? '?add=1#unused-licenses' : '/pricing'} look={look} />
    </div>
  );
}
