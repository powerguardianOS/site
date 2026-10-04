// Test harness: in-memory Cloudflare KV + Brevo, and a real Ed25519 lease key.
// Run a test with:  npx tsx tests/<name>.test.mts
export const kv = new Map<string, string>();
export const mails: { to: string; subject: string; text: string }[] = [];
export const DAY = 86_400_000;

process.env.CLOUDFLARE_KV_NAMESPACE_ID = 'ns';
process.env.CLOUDFLARE_API_TOKEN = 't';
process.env.ADMIN_EMAIL = 'admin@powerguardian.cloud';

const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
process.env.LEASE_PRIVATE_KEY = b64(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
export const PUBKEY = b64(await crypto.subtle.exportKey('raw', kp.publicKey));

(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const u = String(url);
  if (u.includes('api.brevo.com')) {
    const b = JSON.parse(init.body); mails.push({ to: b.to[0].email, subject: b.subject, text: b.textContent });
    return new Response('{}', { status: 201 });
  }
  const method = init.method ?? 'GET';
  if (u.includes('/keys?')) {
    const prefix = decodeURIComponent(new URL(u).searchParams.get('prefix') ?? '');
    return Response.json({ result: [...kv.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })) });
  }
  const k = decodeURIComponent(u.match(/values\/([^?]+)/)![1]);
  if (method === 'PUT') { kv.set(k, init.body); return new Response('{}'); }
  if (method === 'DELETE') { kv.delete(k); return new Response('{}'); }
  return kv.has(k) ? new Response(kv.get(k)!) : new Response('', { status: 404 });
};

export const put = (k: string, v: unknown) => kv.set(k, typeof v === 'string' ? v : JSON.stringify(v));
export const get = <T = any>(k: string): T | undefined => (kv.has(k) ? JSON.parse(kv.get(k)!) : undefined);

export const lic = (id: string, email: string, o: Record<string, unknown> = {}) => ({
  id, email, plan: 'pro', site_id: 's', connector_limit: 5, expires_at: null, status: 'active', notes: '',
  created_at: new Date(Date.now() - 20 * DAY).toISOString(), token: 'tok-' + id + '-' + 'a'.repeat(20), ...o,
});
export function seed(...licenses: any[]) {
  for (const l of licenses) { put('license:' + l.id, l); put('index:token:' + l.token.toLowerCase(), l.id); }
  const ids = JSON.parse(kv.get('index:all') ?? '[]'); put('index:all', [...ids, ...licenses.map((l) => l.id)]);
}

let failed = 0, passed = 0;
export function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${extra ? '  → ' + extra : ''}`);
  ok ? passed++ : failed++;
}
export function done() { console.log(`\n${passed} passed, ${failed} failed`); if (failed) process.exit(1); }
