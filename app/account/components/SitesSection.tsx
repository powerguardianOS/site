import type { SiteTone } from '@/app/lib/site-summary';
import { PLAN_LABEL } from '@/app/lib/account-view';
import type { AccountView, SiteCard, SitePlan, UnusedLicense } from '@/app/lib/account-view';
import OpenConsoleButton from './OpenConsoleButton';
import PowerStrip from './PowerStrip';
import SiteControls from './SiteControls';
import UnderlicensedBanner from './UnderlicensedBanner';
import { planBadge } from './ui';

// ACCOUNT-UI: "My sites" — one calm tile per site, health at a glance, details in the console. PowerGuardian's own
// look: the shield, Fraunces for names, green = Guarded, and a 24 h battery strip (one cell per hour).

const TONE_TEXT: Record<SiteTone, string> = { ok: 'text-white/50', warn: 'text-amber-300', danger: 'text-red-400', offline: 'text-white/40' };
const TONE_HEX: Record<SiteTone, string> = { ok: '#00C66F', warn: '#fbbf24', danger: '#f87171', offline: '#52525b' };

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

function hintFor(site: SiteCard) {
  const lic = site.license;
  const canConsole = lic.status === 'active' && (lic.plan === 'pro' || lic.plan === 'founder');
  const hint = canConsole && !site.online ? 'The console opens when the site is online.'
    : !canConsole && lic.status === 'active' && lic.plan === 'home'
      ? <>Remote console is a Pro feature · <a href="/pricing" className="text-[#00C66F] hover:underline">Upgrade</a></> : null;
  return { clickable: canConsole && site.online, hint };
}

// One tile per site. Online with the console in its plan: the whole tile opens the console.
export function Site({ site, now }: { site: SiteCard; now: number }) {
  const { license: lic, name, model, line } = site;
  const { clickable, hint } = hintFor(site);
  return (
    <article className={`site-card pg-feature relative flex flex-col p-4 ${clickable ? '' : 'hover:!transform-none hover:!shadow-none'}`}
      data-license={lic.id} data-clickable={clickable ? 'yes' : 'no'} aria-label={name}>
      {clickable && <OpenConsoleButton licenseId={lic.id} name={name} />}
      <div className="pointer-events-none relative flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"><Shield tone={line.tone} size={20} /></span>
        <div className={`min-w-0 flex-1 ${clickable ? 'pr-14' : ''}`}>
          <h3 className="site-name pg-display truncate text-xl text-white">{name}</h3>
          <p className={`site-line text-xs ${TONE_TEXT[line.tone]}`}>{line.text}</p>
          {model && <p className="site-model truncate text-[11px] text-white/30">{model}</p>}
        </div>
      </div>
      <div className="relative mt-2 sm:pl-[52px]">
        <PowerStrip id={lic.id} {...site.power} now={now} noUps={site.noUps} />
      </div>
      <div className="relative empty:hidden"><UnderlicensedBanner connectorLimit={lic.capacity} /></div>
      <SiteControls site={site.info} title={name} details={lic.details} hint={hint}
        left={<span className={`site-plan ${planBadge(lic.plan)}`}>{planName(lic.plan)}</span>} />
    </article>
  );
}

function AddSite({ href }: { href: string }) {
  return (
    <a id="add-site" href={href}
      className="flex min-h-[88px] flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-[14px] border border-dashed border-white/15 p-4 text-center transition-colors hover:border-[#00C66F]/50 hover:bg-[#00C66F]/[0.03]">
      <span className="text-sm font-medium text-white/80">+ Add site</span>
      <span className="text-xs text-white/40">Link a controller, or get a license</span>
    </a>
  );
}

// Shown once on the page, for every strip.
function Legend({ noUps }: { noUps: boolean }) {
  const item = (color: string, text: string) => (
    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-1.5 rounded-[1px]" style={{ background: color }} />{text}</span>
  );
  return (
    <p id="power-legend" className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
      <span className="text-white/30">Power, last 24 h:</span>
      {item('#00C66F', 'On mains')}{item('#fbbf24', 'On battery')}{item('rgba(255,255,255,0.12)', 'No data / offline')}
      {noUps && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-3 rounded-[1px] border border-dashed border-white/30" />No UPS on the controller</span>}
    </p>
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

export default function SitesSection({ view }: { view: AccountView }) {
  return (
    <div className="space-y-3">
      <div id="site-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {view.sites.map((s) => <Site key={s.license.id} site={s} now={view.now} />)}
        <AddSite href={view.unused.length ? '?add=1#unused-licenses' : '/pricing'} />
      </div>
      {view.sites.length > 0 && <Legend noUps={view.sites.some((s) => s.noUps)} />}
    </div>
  );
}
