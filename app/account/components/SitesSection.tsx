import { power as powerOf } from '@/app/lib/site-summary';
import type { PowerLevel, SiteTone } from '@/app/lib/site-summary';
import { PLAN_LABEL } from '@/app/lib/account-view';
import type { AccountView, CardStatus, SiteCard, SitePlan, UnusedLicense } from '@/app/lib/account-view';
import OpenConsoleButton from './OpenConsoleButton';
import SiteControls from './SiteControls';
import UnderlicensedBanner from './UnderlicensedBanner';
import { card, planBadge } from './ui';

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return 'moments ago';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function runtime(sec: number): string {
  if (!sec) return '—';
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

// The plain-language power state (lib/site-summary.ts, the same reading the controller's site switcher gets) in colour.
const POWER_TONE: Record<PowerLevel, string> = { none: 'text-zinc-500', danger: 'text-red-400', warn: 'text-amber-400', ok: 'text-green-400', other: 'text-zinc-400' };
function power(raw: string): { label: string; tone: string } {
  const p = powerOf(raw);
  return { label: p.label, tone: POWER_TONE[p.level] };
}

const DOT: Record<SiteTone, string> = { ok: 'bg-green-400', warn: 'bg-amber-400', danger: 'bg-red-500', offline: 'bg-zinc-500' };
function Dot({ tone, big }: { tone: SiteTone; big?: boolean }) {
  const glow = tone === 'ok' && big ? ' shadow-[0_0_0_3px_rgba(74,222,128,0.15)]' : '';
  return <span aria-hidden="true" className={`inline-block ${big ? 'h-2.5 w-2.5' : 'h-2 w-2'} shrink-0 rounded-full ${DOT[tone]}${glow}`} />;
}

export const planName = (plan: string) => PLAN_LABEL[plan as SitePlan] ?? plan;

function Devices({ status }: { status: CardStatus }) {
  const cols = 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_4.5rem_4.5rem_6rem]';
  return (
    <div className="px-4 sm:px-5">
      <div className={`hidden ${cols} gap-x-3 pb-1.5 text-[11px] uppercase tracking-wider text-zinc-500 sm:grid`}>
        <span>Device</span><span>Power</span><span>Battery</span><span>Load</span><span>Runtime</span>
      </div>
      <ul className="divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20 sm:rounded-none sm:border-0 sm:border-t sm:bg-transparent">
        {status.devices.map((d, i) => {
          const p = power(d.ups_status);
          const up = d.state === 'online';
          const ups = !!d.ups_status;
          return (
            <li key={`${d.name}-${i}`} className={`device grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-xs sm:px-0 ${cols}`}>
              <span className="flex min-w-0 items-center gap-2">
                <Dot tone={up ? 'ok' : 'offline'} />
                <span className="truncate text-sm text-white">{d.name || '—'}</span>
                {!up && <span className="shrink-0 text-zinc-500">Offline</span>}
              </span>
              <span className={`text-right sm:text-left ${p.tone}`}>{p.label}</span>
              <span className="col-span-2 pl-4 text-zinc-500 sm:hidden">
                {ups ? `Battery ${Math.round(d.battery_pct)}% · Load ${Math.round(d.load_pct)}% · ${runtime(d.runtime_sec)}` : 'No UPS data'}
              </span>
              <span className="hidden text-white/80 sm:block">{ups ? `${Math.round(d.battery_pct)}%` : '—'}</span>
              <span className="hidden text-white/80 sm:block">{ups ? `${Math.round(d.load_pct)}%` : '—'}</span>
              <span className="hidden text-white/80 sm:block">{ups ? runtime(d.runtime_sec) : '—'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// One card per site: its name and state, its license (plan badge, connectors, term) and its actions.
export function Site({ site }: { site: SiteCard }) {
  const { license: lic, status, name, online, tone } = site;
  const canConsole = lic.status === 'active' && (lic.plan === 'pro' || lic.plan === 'founder');
  const line = status
    ? online ? `Online${status.controller_version ? ` · ${status.controller_version}` : ''}` : `Offline · last seen ${ago(status.received_at)}`
    : 'Waiting for the controller’s first contact';

  const hint = canConsole && !online && status ? 'Console available when the site is online'
    : canConsole && !status ? 'Finish linking on the controller: Settings → License'
    : !canConsole && lic.status === 'active' && lic.plan === 'home'
      ? <>Remote console is a Pro feature · <a href="/pricing" className="text-[#00C66F] hover:underline">Upgrade</a></> : null;

  const facts = [lic.connectors, lic.term, status?.model].filter(Boolean) as string[];

  return (
    <article className={`site-card ${card} overflow-hidden`} data-license={lic.id} aria-label={name}>
      <header className="px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Dot tone={tone} big />
            <h3 className="site-name truncate text-base font-semibold text-white">{name}</h3>
            <span className={`site-plan ${planBadge(lic.plan)}`}>{planName(lic.plan)}</span>
          </div>
          <p className="site-line mt-1 text-xs text-zinc-400">
            {line}
            {tone === 'warn' && ' · needs attention'}
            {tone === 'danger' && ' · low battery'}
          </p>
        </div>
      </header>

      <ul className="site-license flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 text-xs text-zinc-400 sm:px-5" aria-label="License">
        {facts.map((f) => <li key={f}>{f}</li>)}
      </ul>

      {status && status.devices.length > 0 && <div className="pb-3"><Devices status={status} /></div>}
      {status && status.devices.length === 0 && (
        <p className="px-4 pb-3 text-xs text-zinc-500 sm:px-5">No devices adopted on this controller yet.</p>
      )}

      <div className="px-4 empty:hidden sm:px-5"><UnderlicensedBanner connectorLimit={lic.capacity} /></div>

      <SiteControls site={site.info}
        primary={canConsole && online ? <OpenConsoleButton licenseId={lic.id} /> : undefined}
        hint={hint} />
    </article>
  );
}

// Licenses that no controller holds yet, with how to put one to use.
export function UnusedLicenses({ unused }: { unused: UnusedLicense[] }) {
  if (unused.length === 0) return null;
  const founderRoot = unused.some((l) => l.founderRoot);
  return (
    <section id="unused-licenses" className="space-y-3" aria-labelledby="unused-title">
      <div>
        <h2 id="unused-title" className="text-sm font-semibold text-white">Licenses not in use</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Not linked to a controller yet. To use one: on the controller, open <b className="font-medium text-white/80">Settings → License</b> and
          link it with this account’s e-mail address. It picks a free license by itself and shows up above as a site.
          {founderRoot && ' Your Founder license covers as many controllers as you like: each one becomes its own site.'}
        </p>
      </div>
      <ul className={`${card} divide-y divide-white/5`}>
        {unused.map((l) => (
          <li key={l.id} className="unused-license flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-xs sm:px-5">
            <span className={planBadge(l.plan)}>{planName(l.plan)}</span>
            <span className="text-white/80">{l.connectors}</span>
            <span className="text-zinc-500">{l.term}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SitesSection({ view }: { view: AccountView }) {
  return (
    <div className="space-y-3">
      {view.sites.map((s) => <Site key={s.license.id} site={s} />)}
    </div>
  );
}
