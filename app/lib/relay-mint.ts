import { relayBase } from '@/app/lib/relay-url';

// The remote console of a site through the relay: a short-lived, customer-scoped sub-token minted server-side
// (the site's long-lived token never reaches a browser). Used by the portal's Open Console and by a controller's
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
  return { url: `${relayBase()}/console/${token}` };
}

// Which plans include the remote console (the portal shows Open Console for these).
export const consolePlan = (plan: string) => plan === 'pro' || plan === 'founder';
