export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';
import { burnTicket, claimSite, readTicket, leaseFor } from '@/app/lib/sitelink';
import { getLicense } from '@/app/lib/license-db';
import { limitFor } from '@/app/lib/limits';
import { LEASE_DAYS, DAY_S } from '@/app/lib/lease';
import { dateLong, notifyOwner } from '@/app/lib/notify';

// Step two of linking: the controller sends the ticket (from verify-code) and the
// site the customer chose. Only now does it receive its token.
export async function POST(req: NextRequest) {
  if (await rateLimited(`claim:ip:${clientIp(req)}`, 30, 3600)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const body = await req.json().catch(() => null) as { ticket?: unknown; license_id?: unknown; site_name?: unknown; transfer?: unknown; acknowledge?: unknown } | null;
  if (!body || typeof body.ticket !== 'string' || typeof body.license_id !== 'string') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const ticket = await readTicket(body.ticket);
  if (!ticket) return NextResponse.json({ error: 'ticket_expired', message: 'This link attempt has expired. Start again.' }, { status: 401 });

  const r = await claimSite(ticket, body.license_id, { name: body.site_name, transfer: body.transfer, acknowledge: body.acknowledge });
  if (!r.ok) return NextResponse.json({ error: r.error, message: r.message }, { status: r.status });
  await burnTicket(body.ticket); // single use, and only once the claim went through

  const now = Math.floor(Date.now() / 1000);
  const lease = await leaseFor(r.license, ticket.controller_id, now + LEASE_DAYS * DAY_S, 'licensed', now);

  if (r.moved_from !== undefined) {
    await notifyOwner(
      ticket.email, `${r.license.site_name ?? 'Your site'} moved to another controller`,
      `The license of ${r.license.site_name ?? 'your site'} was moved to a new controller (${ticket.hostname || 'unnamed'}).\n\nThe previous controller${r.moved_from ? ` (${r.moved_from})` : ''} keeps working until ${dateLong(now + LEASE_DAYS * DAY_S)} and then locks. Consider buying an extra license for it, or tell its new owner to get one at sales@powerguardian.cloud.\n\nIf you did not do this, contact us right away.`,
    );
  }
  return NextResponse.json({
    token: r.token, license_id: r.license.id, plan: r.license.plan,
    connector_limit: await limitFor(r.license, getLicense), expires_at: r.license.expires_at,
    site_name: r.license.site_name ?? null, lease,
  });
}
