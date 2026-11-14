import { relayBase } from '@/app/lib/relay-url';

// The remote console of a site through the relay: a short-lived, customer-scoped sub-token minted server-side
// (the site's long-lived token never reaches a browser), opened on the site's own console host. Used by the portal's Open Console and by a controller's
// site switcher, so both open a site the same way.
export async function mintConsoleURL(licenseId: string, actor: string): Promise<{ url: string } | { error: string; status: number }> {
  const mintSecret = process.env.RELAY_MINT_SECRET;
  if (!mintSecret) return { error: 'relay not configured', status: 500 };
  const r = await fetch(`${relayBase()}/mint/${licenseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Mint-Secret': mintSecret },
    body: JSON.stringify({ scope: 'customer', actor, ttl_seconds: 600 }),
  });
  if (!r.ok) return { error: 'relay mint failed', status: 502 };
  const { token } = (await r.json()) as { token: string };
  return { url: `${await consoleOrigin(licenseId)}/console/${token}` };
}

// SITE-2: every site's console has its own browser origin, <16 hex of sha256(licence id)>-console.powerguardian.cloud,
// so two sites open in one browser never share cookies or storage (the relay refuses a token on another site's host).
// A local relay (RELAY_BASE_URL) forwards /console/ links to that host itself.
export async function siteLabel(licenseId: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(licenseId));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function consoleOrigin(licenseId: string): Promise<string> {
  if (process.env.RELAY_BASE_URL) return relayBase();
  return `https://${await siteLabel(licenseId)}${process.env.CONSOLE_HOST_SUFFIX || '-console.powerguardian.cloud'}`;
}

// Which plans include the remote console (the portal shows Open Console for these).
export const consolePlan = (plan: string) => plan === 'pro' || plan === 'founder';
