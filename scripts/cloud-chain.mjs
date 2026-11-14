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
  // LOGIN-1: opening the link (GET) only shows the confirm page; the button POSTs the token.
  const g = await fetch(link, { redirect: 'manual' });
  ok('opening the link shows the confirm page and signs nobody in', g.status === 200 && g.headers.get('set-cookie') === null);
  const confirm = () => fetch(SITE + '/api/auth/verify', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN }, body: new URLSearchParams({ token: new URL(link).searchParams.get('token') }).toString() });
  const v = await confirm();
  const cookie = (v.headers.get('set-cookie') ?? '').match(/pg_session=[^;]+/)?.[0];
  ok('the confirm button sets a session cookie', !!cookie);
  ok('the link is single-use', (await confirm()).headers.get('set-cookie') === null);
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

  console.log('7. founder: unlimited controllers (each new controller gets its own founder site)');
  const FOUNDER = 'founder@example.test';
  const CA = 'a1'.repeat(24), CB = 'b2'.repeat(24), CC = 'c3'.repeat(24);
  const fr = await post('/api/admin/licenses', { email: FOUNDER, plan: 'founder', connector_limit: 0, site_name: 'Founder home' }, { cookie });
  ok('admin creates the founder licence (limit 0, never expires)', fr.status === 201 && fr.license?.expires_at === null, fr.error);
  const rootId = fr.license?.id;
  const linkAs = async (cid, host) => {
    for (const k of [...kv.keys()]) if (k.startsWith('rl:sendcode') || k.startsWith('rl:verifycode')) kv.delete(k);
    const n = mails.filter((m) => m.to === FOUNDER).length;
    await post('/api/license/send-code', { email: FOUNDER });
    const c = (await waitMail(FOUNDER, n + 1))?.text.match(/code is: (\d{6})/)?.[1];
    return post('/api/license/verify-code', { email: FOUNDER, code: c, controller_id: cid, hostname: host });
  };
  const hbAs = (t, cid) => fetch(SITE + '/api/cloud/heartbeat', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ controller_id: cid, hostname: 'h', site_name: 'x', devices: [] }) }).then(j);
  const leaseLimit = (l) => JSON.parse(Buffer.from(l.split('.')[0], 'base64url').toString()).connector_limit;

  let fv = await linkAs(CA, 'ctrl-a');
  ok('controller A: "New site" is offered next to the founder site', fv.valid && fv.sites?.some((s) => s.new && s.license_id === 'new') && fv.sites.some((s) => s.license_id === rootId), JSON.stringify(fv).slice(0, 120));
  const ca = await post('/api/license/claim', { ticket: fv.ticket, license_id: 'new', site_name: '' });
  ok('controller A gets a NEW founder site (limit 0, never expires)', ca.status === 200 && ca.license_id !== rootId && ca.plan === 'founder' && ca.connector_limit === 0 && ca.expires_at === null && ca.site_name === 'ctrl-a', ca.error);
  fv = await linkAs(CB, 'ctrl-b');
  const cb = await post('/api/license/claim', { ticket: fv.ticket, license_id: 'new', site_name: 'Office' });
  ok('controller B gets another new founder site', cb.status === 200 && cb.license_id !== ca.license_id && cb.license_id !== rootId && cb.site_name === 'Office', cb.error);
  const ha = await hbAs(ca.token, CA), hbB = await hbAs(cb.token, CB);
  ok('A and B heartbeat licensed, lease limit 0', ha.state === 'licensed' && hbB.state === 'licensed' && leaseLimit(ha.lease) === 0 && leaseLimit(hbB.lease) === 0, `${ha.state}/${hbB.state}`);
  const vx = await post('/api/license/verify', { license_key: ca.token, connector_count: 999 });
  ok('999 connectors: not underlicensed', vx.valid === true && vx.status === 'valid');

  ok('controller C (migrated from A, same token) is an unconfirmed copy first', (await hbAs(ca.token, CC)).state === 'unconfirmed_copy');
  fv = await linkAs(CC, 'ctrl-c');
  ok('site A is suggested first for C', fv.sites?.[0]?.license_id === ca.license_id && fv.sites[0].suggested === true, JSON.stringify(fv.sites?.[0]).slice(0, 120));
  const cc = await post('/api/license/claim', { ticket: fv.ticket, license_id: ca.license_id, transfer: true, acknowledge: true });
  ok('C takes over the same founder site A (transfer, new token)', cc.status === 200 && cc.license_id === ca.license_id && cc.token !== ca.token && cc.connector_limit === 0, cc.error);
  kv.delete(`sitestatus:${ca.license_id}`); // skip the 15 s heartbeat throttle
  const hc = await hbAs(cc.token, CC);
  ok('C heartbeats licensed; A is now the moved-away controller', hc.state === 'licensed' && (await hbAs(ca.token, CA)).state === 'moved', hc.state);

  const rr = await fetch(`${SITE}/api/admin/licenses/${rootId}`, { method: 'PATCH', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie }, body: JSON.stringify({ status: 'revoked' }) }).then(j);
  ok('admin revokes the founder licence; both founder sites follow', rr.status === 200 && rr.followed?.length === 2 && rr.followed.includes(ca.license_id) && rr.followed.includes(cb.license_id), JSON.stringify(rr).slice(0, 160));
  const all = (await fetch(SITE + '/api/admin/licenses', { headers: { cookie, origin: ORIGIN } }).then(j)).licenses ?? [];
  ok('all three founder records are revoked', [rootId, ca.license_id, cb.license_id].every((id) => all.find((l) => l.id === id)?.status === 'revoked'));
  kv.delete(`sitestatus:${ca.license_id}`); kv.delete(`sitestatus:${cb.license_id}`);
  const dc = await hbAs(cc.token, CC), db = await hbAs(cb.token, CB);
  ok('heartbeats of C and B are denied', dc.status === 403 && db.status === 403, `${dc.status}/${db.status}`);
  ok('relay refuses the founder sites', (await val(cc.token)).valid === false && (await val(cb.token)).valid === false);
} catch (e) { console.log(' FAIL  script error', e, e.cause); fail++; }
finally { stop(); console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log('--- next log tail ---\n' + nextLog.slice(-1500)); process.exit(fail ? 1 : 0); }
