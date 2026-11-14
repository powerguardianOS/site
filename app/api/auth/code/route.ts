export const runtime = 'edge';

// POST {code}: the 6-digit code from the sign-in mail (app/lib/signin-code.ts), same origin only, from the browser that
// asked for it. Answers JSON {ok, next} (the page then goes there: two-step sign-in, a controller's sign-in, a site
// switch, or the account) with the same cookies as the link's confirm button.
import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin } from '@/app/lib/page-html';
import { afterLinkConfirmed, signInTarget, clearSignInNext } from '@/app/lib/signin-step';
import { checkSignInCode, codeCookie, CODE_COOKIE } from '@/app/lib/signin-code';

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: 'origin' }, { status: 403 });
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code.replace(/\D/g, '') : '';
  const bind = request.cookies.get(CODE_COOKIE)?.value ?? '';
  const res = await checkSignInCode(bind, code);
  if (!('email' in res)) {
    const out = NextResponse.json({ ok: false, ...res }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    if (res.error === 'expired' && bind) out.headers.append('Set-Cookie', codeCookie('', 0));
    return out;
  }
  const step = await afterLinkConfirmed(request, res.email, signInTarget(request));
  const loc = new URL(step.headers.get('location') ?? '/account', request.url);
  const out = NextResponse.json({ ok: true, next: loc.pathname + loc.search }, { headers: { 'Cache-Control': 'no-store' } });
  clearSignInNext(request, out); // first: cookies.set rewrites the Set-Cookie headers appended before it
  for (const c of step.headers.getSetCookie()) out.headers.append('Set-Cookie', c);
  out.headers.append('Set-Cookie', codeCookie('', 0));
  return out;
}
