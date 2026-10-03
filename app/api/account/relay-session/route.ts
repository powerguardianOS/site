export const runtime = 'edge';

import { cookies } from 'next/headers';
import { getSession } from '@/app/lib/session';
import { getLicensesByEmail } from '@/app/lib/license-db';

// Mints a short-lived, scoped relay sub-token for the caller's own license
// and returns a ready-to-open console URL. The long-lived license token
// (the controller's actual relay credential) never leaves this server —
// it used to be rendered directly in the browser as a clickable relay link,
// which meant anyone who ever saw that page had permanent, unscoped access.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pg_session')?.value ?? '';
  const email = await getSession(sessionId);
  if (!email) {
    return Response.json({ error: 'not authenticated' }, { status: 401 });
  }

  let body: { license_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!body.license_id) {
    return Response.json({ error: 'license_id required' }, { status: 400 });
  }

  // Authorization check: the requested license must actually belong to the
  // authenticated account. Never trust a client-supplied license_id alone —
  // this is exactly the kind of check the account page itself never had.
  const licenses = await getLicensesByEmail(email);
  const license = licenses.find((l) => l.id === body.license_id);
  if (!license) {
    return Response.json({ error: 'license not found' }, { status: 404 });
  }
  if (!license.token) {
    return Response.json({ error: 'license has no relay token' }, { status: 400 });
  }

  const mintSecret = process.env.RELAY_MINT_SECRET;
  if (!mintSecret) {
    return Response.json({ error: 'relay not configured' }, { status: 500 });
  }

  const mintResp = await fetch(`https://relay.powerguardian.cloud/mint/${license.token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Mint-Secret': mintSecret },
    body: JSON.stringify({ scope: 'customer', actor: email, ttl_seconds: 600 }),
  });
  if (!mintResp.ok) {
    return Response.json({ error: 'relay mint failed' }, { status: 502 });
  }
  const { token } = (await mintResp.json()) as { token: string };

  return Response.json({ console_url: `https://relay.powerguardian.cloud/console/${token}` });
}
