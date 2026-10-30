// CLOUD-1: walk the whole licence chain on this machine, 127.0.0.1 only.
//   admin login -> create licence -> controller claims it -> heartbeat -> lease verifies -> relay validate -> revoke
// Starts a fake Cloudflare KV + fake Brevo (in this process) and `next dev` against them. Touches nothing live.
// Usage: PATH=~/dev/.tools/node/bin:$PATH node scripts/cloud-chain.mjs
import http from 'node:http';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, createPrivateKey, verify as edVerify, createPublicKey } from 'node:crypto';

const KV_PORT = 8788, SITE_PORT = 3100, H = '127.0.0.1';
const SITE = `http://${H}:${SITE_PORT}`;
const ORIGIN = `http://localhost:${SITE_PORT}`; // next dev reports its own URL as localhost
const kv = new Map(); const mails = [];
const ADMIN = 'admin@powerguardian.cloud', CUSTOMER = 'customer@example.test', MINT = 'local-mint-secret';
const CTRL = 'c0ffee'.repeat(8); // 48 hex = hardware id of the test controller

// ---- fake Cloudflare KV + Brevo
const fake = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let body = ''; for await (const c of req) body += c;
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

const next = spawn('npx', ['next', 'dev', '-H', H, '-p', String(SITE_PORT)], {
  env: { ...process.env, CLOUDFLARE_API_BASE: `http://${H}:${KV_PORT}`, BREVO_API_BASE: `http://${H}:${KV_PORT}`, CLOUDFLARE_KV_NAMESPACE_ID: 'ns', CLOUDFLARE_API_TOKEN: 't',
    ADMIN_EMAIL: ADMIN, LEASE_PRIVATE_KEY: pkcs8, RELAY_MINT_SECRET: MINT, NEXT_PUBLIC_BASE_URL: SITE, BREVO_API_KEY: 'x', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let nextLog = ''; next.stdout.on('data', (d) => (nextLog += d)); next.stderr.on('data', (d) => (nextLog += d));
const stop = () => { next.kill('SIGTERM'); fake.close(); };

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  -> ' + extra : ''}`); cond ? pass++ : fail++; return cond; };
const j = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
const post = (path, body, headers = {}) => fetch(SITE + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) }).then(j);
const waitMail = async (to, n = 1) => { for (let i = 0; i < 50; i++) { const m = mails.filter((x) => x.to === to); if (m.length >= n) return m.at(-1); await new Promise((r) => setTimeout(r, 100)); } return null; };

try {
  for (let i = 0; i < 120; i++) { try { await fetch(SITE + '/api/license/verify', { method: 'POST', body: '{}' }); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }

  console.log('1. admin signs in (magic link from the fake mailbox)');
  ok('magic request accepted', (await post('/api/auth/magic', { email: ADMIN })).ok === true);
  const link = (await waitMail(ADMIN))?.text.match(/https?:\/\/\S+\/api\/auth\/verify\?token=\w+/)?.[0];
  ok('mail contains the link', !!link);
  const v = await fetch(link, { redirect: 'manual' });
  const cookie = (v.headers.get('set-cookie') ?? '').match(/pg_session=[^;]+/)?.[0];
  ok('link sets a session cookie', !!cookie);
  ok('the link is single-use', (await fetch(link, { redirect: 'manual' })).headers.get('set-cookie') === null);
  ok('app logs no sign-in link (only the dev server access log has the URL)', !/FALLBACK|magicUrl/.test(nextLog));

  console.log('2. admin creates a licence');
  const created = await post('/api/admin/licenses', { email: CUSTOMER, plan: 'pro', connector_limit: 5, expires_at: new Date(Date.now() + 365 * 864e5).toISOString(), site_name: 'Local test site' }, { cookie });
  ok('licence created (201)', created.status === 201, created.error);
  const licId = created.license?.id;
  ok('anonymous admin call refused', (await post('/api/admin/licenses', { email: 'x@y.nl', plan: 'pro', connector_limit: 1 })).status === 401);

  console.log('3. controller links the licence (what Settings > License does)');
  ok('send-code accepted', (await post('/api/license/send-code', { email: CUSTOMER })).sent === true);
  const code = (await waitMail(CUSTOMER))?.text.match(/code is: (\d{6})/)?.[1];
  ok('code mailed', !!code);
  const vc = await post('/api/license/verify-code', { email: CUSTOMER, code, controller_id: CTRL, hostname: 'test-ctrl' });
  ok('code accepted: ticket + the free site offered', vc.valid && vc.ticket && vc.sites?.[0]?.license_id === licId && vc.sites[0].state === 'free', JSON.stringify(vc).slice(0, 100));
  ok('the token is NOT handed out before the claim', vc.token === undefined);
  const claim = await post('/api/license/claim', { ticket: vc.ticket, license_id: licId, site_name: 'Local test site' });
  ok('claim returns token + signed lease', claim.status === 200 && !!claim.token && !!claim.lease, claim.error);
  const token = claim.token;
  const leaseOk = (lease) => { const [p, s] = lease.split('.'); return edVerify(null, Buffer.from(p), createPublicKey({ key: spki, format: 'der', type: 'spki' }), Buffer.from(s, 'base64url')); };
  let leaseOkRes = false; try { leaseOkRes = leaseOk(claim.lease); } catch {}
  ok('lease signature verifies with the public key', leaseOkRes);

  console.log('4. heartbeat + lease');
  const hb = (t = token) => fetch(SITE + '/api/cloud/heartbeat', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ controller_id: CTRL, hostname: 'test-ctrl', site_name: 'Local test site', controller_version: '0.0.0-test', devices: [{ name: 'ups1', state: 'online', battery_pct: 100 }] }) }).then(j);
  const h1 = await hb();
  ok('heartbeat accepted, state licensed, fresh lease', h1.status === 200 && h1.state === 'licensed' && !!h1.lease, JSON.stringify(h1).slice(0, 100));
  ok('heartbeat with a wrong token: 401', (await hb('0'.repeat(32))).status === 401);
  ok('second heartbeat within 15 s is throttled (429)', (await hb()).status === 429);
  const otherCtrl = await fetch(SITE + '/api/cloud/heartbeat', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ controller_id: 'beef'.repeat(12), hostname: 'copy' }) }).then(j);
  ok('a copy of the controller is flagged, not treated as the holder', otherCtrl.state === 'unconfirmed_copy', otherCtrl.state);

  console.log('5. relay token validation (what the relay worker asks the site)');
  const val = (t, secret = MINT) => post('/api/relay/validate', { token: t }, secret ? { 'X-Mint-Secret': secret } : {});
  const rv = await val(token);
  ok('active licence token is valid and maps to the licence id', rv.valid === true && rv.license_id === licId);
  ok('without the shared secret: 401', (await val(token, null)).status === 401);

  console.log('6. revoke');
  const rev = await fetch(`${SITE}/api/admin/licenses/${licId}`, { method: 'PATCH', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie }, body: JSON.stringify({ status: 'revoked' }) }).then(j);
  ok('admin revokes the licence', rev.status === 200, rev.error);
  ok('relay validate now says invalid', (await val(token)).valid === false);
  await new Promise((r) => setTimeout(r, 200));
  const h2 = await hb(); ok('heartbeat after revoke is denied (no fresh lease)', h2.status >= 400 || !h2.lease, JSON.stringify(h2).slice(0, 120));
  const v2 = await post('/api/license/verify', { license_key: token }); ok('legacy verify says invalid', v2.valid === false);
} catch (e) { console.log(' FAIL  script error', e, e.cause); fail++; }
finally { stop(); console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log('--- next log tail ---\n' + nextLog.slice(-1500)); process.exit(fail ? 1 : 0); }
