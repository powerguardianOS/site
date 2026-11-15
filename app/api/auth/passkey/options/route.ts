export const runtime = 'edge';

// PASSKEYS-1: passwordless sign-in, step 1. POST (same origin) → { publicKey } for navigator.credentials.get with no
// allowCredentials (the browser offers this site's passkeys: the modal button, the account card, or autofill on the
// e-mail field). The challenge is bound to a random HttpOnly cookie of this browser (2 minutes, single use).
import { NextResponse } from 'next/server';
import { sameOrigin } from '@/app/lib/page-html';
import { rateLimited, clientIp } from '@/app/lib/ratelimit';
import { requestOptions, PK_COOKIE, PK_PATH, CHALLENGE_TTL_S } from '@/app/lib/passkeys';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ ok: false, error: 'origin' }, 403);
  try {
    if (await rateLimited(`pk:options:ip:${clientIp(request)}`, 60, 900, true)) return json({ ok: false, error: 'too_many' }, 429);
  } catch {
    return json({ ok: false, error: 'unavailable' }, 503);
  }
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  const bind = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const res = json({ ok: true, publicKey: await requestOptions('signin', 'cookie:' + bind) });
  res.cookies.set(PK_COOKIE, bind, { httpOnly: true, secure: true, sameSite: 'strict', path: PK_PATH, maxAge: CHALLENGE_TTL_S });
  return res;
}
