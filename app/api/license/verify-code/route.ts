export const runtime = 'edge';
import { kvGet, kvDel } from '@/app/lib/kv';
import { NextRequest, NextResponse } from 'next/server';
import { getLinkableLicense, getLicenses } from '@/app/lib/license-db';
import { effectiveLimit } from '@/app/lib/limits';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';
import { createTicket, listChoices } from '@/app/lib/sitelink';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email;
  const code: string | undefined = body?.code;

  if (!email || !code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  if (
    (await rateLimited(`verifycode:ip:${clientIp(req)}`, 30, 3600)) ||
    (await rateLimited(`verifycode:email:${email.toLowerCase()}`, 10, 3600))
  ) {
    return NextResponse.json({ valid: false, error: 'rate_limited' }, { status: 429 });
  }

  const raw = await kvGet(`otp:${email.toLowerCase()}`);
  if (!raw) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  try {
    const { code: stored, expires } = JSON.parse(raw);
    await kvDel(`otp:${email.toLowerCase()}`);

    if (expires < Date.now()) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
    if (stored !== code) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
    // New controllers send their hardware ID. They get a short-lived claim ticket and the
    // list of sites to choose from — never a token: that only comes after the claim.
    const cid = typeof body?.controller_id === 'string' && /^[0-9a-f]{32,64}$/i.test(body.controller_id) ? body.controller_id.toLowerCase() : '';
    if (cid) {
      const choices = await listChoices(email, cid);
      if (choices.length === 0) {
        const any = (await getLicenses()).some((l) => l.email.toLowerCase() === email.toLowerCase() && l.plan !== 'addon_connector');
        return NextResponse.json(any ? { valid: true, error: 'no_site' } : { valid: false }, { status: any ? 409 : 404 });
      }
      const host = typeof body?.hostname === 'string' ? body.hostname.replace(/[^\w.-]/g, '').slice(0, 63) : '';
      return NextResponse.json({ valid: true, ticket: await createTicket(email, cid, host), expires_in: 600, sites: choices });
    }

    // The license (incl. its relay token) is only ever handed out here, to the
    // caller who just proved control of the mailbox. There is deliberately no
    // separate unauthenticated lookup-by-email endpoint.
    const license = await getLinkableLicense(email);
    if (!license) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }
    return NextResponse.json({
      valid: true,
      plan: license.plan,
      connector_limit: effectiveLimit(license, await getLicenses()),
      expires_at: license.expires_at,
      token: license.token,
    });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
