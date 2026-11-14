// SESSIONS-1: what the account page can say about a browser — device and browser from the User-Agent (a few rules, no
// library), the approximate place from Cloudflare's own request data (never an external geo service), and the IP.
//   - place: CF-IPCountry is on every request through Cloudflare (IP geolocation). The city comes only from
//     CF-IPCity (the "Add visitor location headers" managed transform) or request.cf.city where the runtime exposes it;
//     without either, the country alone.
//   - IP: kept whole only inside the session record (lives as long as the session); shown and logged masked
//     (178.229.x.x, 2a02:a46f:…) so a screenshot of the account page or a 90-day activity line never carries a full address.
export type ClientInfo = { ua: string; ip: string; country: string; city: string };

const clip = (s: string | null | undefined, n: number) => (s ?? '').slice(0, n);

export function clientInfo(request: Request | Headers | null | undefined): ClientInfo {
  if (!request) return { ua: '', ip: '', country: '', city: '' };
  const h = request instanceof Headers ? request : request.headers;
  const cf = (request as unknown as { cf?: { country?: string; city?: string } }).cf;
  const ip = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  const country = (cf?.country ?? h.get('cf-ipcountry') ?? '').toUpperCase();
  let city = cf?.city ?? h.get('cf-ipcity') ?? '';
  try { city = decodeURIComponent(city); } catch { /* as sent */ }
  return {
    ua: clip(h.get('user-agent'), 300),
    ip: /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : '',
    country: /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : '', // XX unknown, T1 Tor
    city: clip(city.replace(/[<>"]/g, ''), 60),
  };
}

export function maskIp(ip: string): string {
  if (!ip) return '';
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.x.x`;
  if (ip.includes(':')) {
    const groups = ip.split(':').filter(Boolean).slice(0, 2);
    return groups.length ? `${groups.join(':')}:…` : '';
  }
  return '';
}

export function countryName(code: string): string {
  if (!code) return '';
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code; } catch { return code; }
}

export function placeLabel(country: string, city: string): string {
  const c = countryName(country);
  return city && c ? `${city}, ${c}` : c || city;
}

export type Device = { device: string; browser: string };

// Enough for "is that me?": the kind of device and the browser. Unknown → "Unknown device" / "Browser".
export function parseUserAgent(ua: string): Device {
  const s = ua || '';
  let device = 'Unknown device';
  if (/iPad/.test(s)) device = 'iPad';
  else if (/iPhone|iPod/.test(s)) device = 'iPhone';
  else if (/Android/.test(s)) device = /Mobile/.test(s) ? 'Android phone' : 'Android tablet';
  else if (/CrOS/.test(s)) device = 'Chromebook';
  else if (/Macintosh|Mac OS X/.test(s)) device = /Mobile\//.test(s) ? 'iPad' : 'Mac'; // iPadOS asks for the desktop site
  else if (/Windows/.test(s)) device = 'Windows PC';
  else if (/Linux/.test(s)) device = 'Linux PC';

  let browser = 'Browser';
  if (/EdgiOS|EdgA?\//.test(s)) browser = 'Edge';
  else if (/OPR\/|OPiOS/.test(s)) browser = 'Opera';
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung Internet';
  else if (/FxiOS|Firefox\//.test(s)) browser = 'Firefox';
  else if (/CriOS|Chrome\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari';
  else if (/AppleWebKit/.test(s) && /iPhone|iPad|Macintosh/.test(s)) browser = 'Safari'; // home-screen app, in-app views
  return { device, browser };
}

export const deviceLabel = (ua: string) => { const d = parseUserAgent(ua); return `${d.device} · ${d.browser}`; };

// What an activity line keeps about the browser that did it (masked, no raw User-Agent).
export function activityCtx(request: Request | Headers | null | undefined): { ip?: string; place?: string; device?: string } {
  const c = clientInfo(request);
  if (!c.ua && !c.ip) return {};
  return { ip: maskIp(c.ip) || undefined, place: placeLabel(c.country, c.city) || undefined, device: c.ua ? deviceLabel(c.ua) : undefined };
}
