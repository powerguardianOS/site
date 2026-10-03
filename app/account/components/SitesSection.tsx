import { getSiteStatus, isOnline } from '@/app/lib/site-status';
import type { SiteStatus } from '@/app/lib/site-status';
import OpenConsoleButton from './OpenConsoleButton';

type Lic = { id: string; plan: string; status: string };

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

// NUT status tokens → plain language. Order matters: the worst state wins.
function power(raw: string): { label: string; tone: string } {
  const s = raw.toUpperCase();
  if (!s) return { label: 'No UPS data', tone: 'text-zinc-500' };
  if (s.includes('LB')) return { label: 'Low battery', tone: 'text-red-400' };
  if (s.includes('OB')) return { label: 'On battery', tone: 'text-amber-400' };
  if (s.includes('RB')) return { label: 'Replace battery', tone: 'text-amber-400' };
  if (s.includes('OL')) return { label: 'On mains', tone: 'text-green-400' };
  return { label: raw, tone: 'text-zinc-400' };
}

function Dot({ on }: { on: boolean }) {
  return <span className={`h-2 w-2 rounded-full ${on ? 'bg-green-400' : 'bg-zinc-500'}`} />;
}

function Site({ lic, status }: { lic: Lic; status: SiteStatus | null }) {
  const online = isOnline(status);
  const canConsole = lic.status === 'active' && (lic.plan === 'pro' || lic.plan === 'founder');

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Dot on={online} />
            <h3 className="text-sm font-semibold text-white">{status ? status.site_name : 'Waiting for first connection'}</h3>
          </div>
          <p className="text-xs text-zinc-500">
            {status
              ? `${online ? 'Online' : `Offline — last seen ${ago(status.received_at)}`}${status.controller_version ? ` · controller ${status.controller_version}` : ''}`
              : 'Link your license on the controller: Settings → License.'}
          </p>
        </div>
        {canConsole && online && <div className="text-sm"><OpenConsoleButton licenseId={lic.id} /></div>}
        {canConsole && !online && status && <span className="text-xs text-zinc-500">Console available when online</span>}
        {!canConsole && lic.status === 'active' && lic.plan === 'home' && (
          <span className="text-xs text-zinc-500">
            Remote console is a Pro feature <a href="/pricing" className="underline">Learn more</a>
          </span>
        )}
      </div>

      {status && status.devices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500">
                {['Device', 'Status', 'Power', 'Battery', 'Load', 'Runtime'].map(h => (
                  <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {status.devices.map((d, i) => {
                const p = power(d.ups_status);
                const up = d.state === 'online';
                return (
                  <tr key={`${d.name}-${i}`}>
                    <td className="py-2 pr-4 text-white">{d.name || '—'}</td>
                    <td className="py-2 pr-4"><span className="inline-flex items-center gap-1.5"><Dot on={up} />{up ? 'Online' : 'Offline'}</span></td>
                    <td className={`py-2 pr-4 ${p.tone}`}>{p.label}</td>
                    <td className="py-2 pr-4 text-white/80">{d.ups_status ? `${Math.round(d.battery_pct)}%` : '—'}</td>
                    <td className="py-2 pr-4 text-white/80">{d.ups_status ? `${Math.round(d.load_pct)}%` : '—'}</td>
                    <td className="py-2 pr-4 text-white/80">{d.ups_status ? runtime(d.runtime_sec) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {status && status.devices.length === 0 && (
        <p className="text-xs text-zinc-500">No devices adopted on this controller yet.</p>
      )}
    </div>
  );
}

export default async function SitesSection({ licenses }: { licenses: Lic[] }) {
  // Add-on licenses extend a site's connector allowance; they are not sites.
  const siteLicenses = licenses.filter(l => l.plan !== 'addon_connector');
  const statuses = await Promise.all(siteLicenses.map(l => getSiteStatus(l.id)));

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">My sites</h2>
      {siteLicenses.length === 0 ? (
        <p className="text-xs text-zinc-500">Connect a controller to start monitoring your UPS.</p>
      ) : siteLicenses.map((l, i) => <Site key={l.id} lic={l} status={statuses[i]} />)}
    </div>
  );
}
