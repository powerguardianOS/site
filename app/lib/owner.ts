import { cookies } from 'next/headers';
import { getSession } from '@/app/lib/session';
import { sendEmail } from '@/app/lib/email';

// Guard for customer API routes: a signed-in session, plus for anything that
// changes state a JSON content-type and a same-origin Origin (like adminGuard).
export async function ownerGuard(request: Request): Promise<{ email: string; sessionId: string } | Response> {
  const sessionId = (await cookies()).get('pg_session')?.value ?? '';
  const email = sessionId ? await getSession(sessionId) : null;
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (request.method !== 'GET') {
    if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return Response.json({ error: 'application/json required' }, { status: 415 });
    }
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).host !== new URL(request.url).host) {
      return Response.json({ error: 'cross-origin request refused' }, { status: 403 });
    }
  }
  return { email: email.toLowerCase(), sessionId };
}

// ---- re-confirmation: sensitive actions need a fresh e-mail code on top of the session

const ACCOUNT_ID = '5f4b3228b678331dd09cf6bfe8514857';
const KV_NS = () => process.env.CLOUDFLARE_KV_NAMESPACE_ID!;
const CF_TOKEN = () => process.env.CLOUDFLARE_API_TOKEN!;
const BASE = () => `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS()}`;
const H = () => ({ Authorization: `Bearer ${CF_TOKEN()}`, 'Content-Type': 'text/plain' });
const kvGet = async (k: string) => { const r = await fetch(`${BASE()}/values/${encodeURIComponent(k)}`, { headers: H() }); return r.ok ? r.text() : null; };
const kvPut = (k: string, v: string, ttl: number) => fetch(`${BASE()}/values/${encodeURIComponent(k)}?expiration_ttl=${ttl}`, { method: 'PUT', headers: H(), body: v });
const kvDel = (k: string) => fetch(`${BASE()}/values/${encodeURIComponent(k)}`, { method: 'DELETE', headers: H() });

export async function sendReconfirmCode(email: string): Promise<void> {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = String(100000 + (buf[0] % 900000));
  await kvPut(`reconfirm:code:${email}`, JSON.stringify({ code, tries: 0 }), 600);
  await sendEmail(email, 'Confirm this action', `Your confirmation code is: ${code}\n\nIt is valid for 10 minutes. If you did not start this, do not enter it and contact us right away.\n\n— PowerGuardian`, { code });
}

export async function verifyReconfirmCode(email: string, sessionId: string, code: unknown): Promise<boolean> {
  const raw = await kvGet(`reconfirm:code:${email}`);
  if (!raw || typeof code !== 'string') return false;
  const rec = JSON.parse(raw) as { code: string; tries: number };
  if (rec.tries >= 5) { await kvDel(`reconfirm:code:${email}`); return false; }
  if (rec.code !== code.trim()) {
    await kvPut(`reconfirm:code:${email}`, JSON.stringify({ ...rec, tries: rec.tries + 1 }), 600);
    return false;
  }
  await kvDel(`reconfirm:code:${email}`);
  await kvPut(`reconfirm:ok:${sessionId}`, '1', 600);
  return true;
}

export async function isReconfirmed(sessionId: string): Promise<boolean> {
  return (await kvGet(`reconfirm:ok:${sessionId}`)) === '1';
}
