// CLOUD-1: long-lived local setup: fake Cloudflare KV + fake Brevo (127.0.0.1:8788) and `next dev` (127.0.0.1:3100).
// Same env as cloud-chain.mjs, no steps. Touches nothing live.
//   PATH=~/dev/.tools/node/bin:$PATH node scripts/cloud-dev.mjs
// Prints the lease public key (PG_LEASE_PUBKEY for a controller). Mailbox: GET http://127.0.0.1:8788/__mails
// Also importable: `const dev = await startDev(); ... dev.stop()`.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const H = '127.0.0.1', KV_PORT = 8788, SITE_PORT = 3100, RELAY_PORT = 8787;
export const SITE = `http://${H}:${SITE_PORT}`;
export const ORIGIN = `http://localhost:${SITE_PORT}`; // next dev reports its own URL as localhost
export const ADMIN = 'admin@powerguardian.cloud', MINT = 'local-mint-secret';

export async function startDev() {
  const kv = new Map(); const mails = [];
  const fake = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'); let body = ''; for await (const c of req) body += c;
    if (u.pathname === '/__mails') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(mails)); return; }
    if (u.pathname === '/v3/smtp/email') { const b = JSON.parse(body); mails.push({ to: b.to[0].email, subject: b.subject, text: b.textContent }); res.writeHead(201).end('{}'); return; }
    if (u.pathname.endsWith('/keys')) { const p = u.searchParams.get('prefix') ?? ''; res.writeHead(200).end(JSON.stringify({ result: [...kv.keys()].filter((k) => k.startsWith(p)).sort().map((name) => ({ name })) })); return; }
    const m = u.pathname.match(/\/values\/(.+)$/); if (!m) { res.writeHead(404).end(); return; }
    const k = decodeURIComponent(m[1]);
    if (req.method === 'PUT') { kv.set(k, body); res.writeHead(200).end('{}'); }
    else if (req.method === 'DELETE') { kv.delete(k); res.writeHead(200).end('{}'); }
    else if (kv.has(k)) res.writeHead(200).end(kv.get(k)); else res.writeHead(404).end();
  });
  await new Promise((r) => fake.listen(KV_PORT, H, r));

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const rawPub = spki.subarray(spki.length - 32).toString('base64'); // 32-byte raw key, what the controller expects

  const next = spawn('npx', ['next', 'dev', '-H', H, '-p', String(SITE_PORT)], {
    env: { ...process.env, CLOUDFLARE_API_BASE: `http://${H}:${KV_PORT}`, BREVO_API_BASE: `http://${H}:${KV_PORT}`, CLOUDFLARE_KV_NAMESPACE_ID: 'ns', CLOUDFLARE_API_TOKEN: 't',
      ADMIN_EMAIL: ADMIN, LEASE_PRIVATE_KEY: pkcs8, RELAY_MINT_SECRET: MINT, RELAY_BASE_URL: `http://${H}:${RELAY_PORT}`, NEXT_PUBLIC_BASE_URL: SITE, BREVO_API_KEY: 'x', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = { text: '' }; next.stdout.on('data', (d) => (log.text += d)); next.stderr.on('data', (d) => (log.text += d));
  const stop = () => { next.kill('SIGTERM'); fake.close(); };
  for (let i = 0; i < 120; i++) { try { await fetch(SITE + '/api/license/verify', { method: 'POST', body: '{}' }); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
  return { kv, mails, rawPub, log, stop };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dev = await startDev();
  console.log(`site ${SITE}  fake KV/Brevo http://${H}:${KV_PORT}  mailbox /__mails\nPG_LEASE_PUBKEY=${dev.rawPub}\nRELAY_MINT_SECRET=${MINT}  RELAY_BASE_URL=http://${H}:${RELAY_PORT}`);
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { dev.stop(); process.exit(0); });
}
