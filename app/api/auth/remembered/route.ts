export const runtime = 'edge';

// PASSKEYS-1: POST { action: 'forget', handle } (same origin): "Forget" on the remembered-account card removes the
// server half too (app/lib/remember.ts). Always answers ok (nothing to learn from it).
import { sameOrigin } from '@/app/lib/page-html';
import { forgetHandle } from '@/app/lib/remember';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { action?: unknown; handle?: unknown } | null;
  if (body?.action === 'forget') await forgetHandle(body.handle).catch(() => {});
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
