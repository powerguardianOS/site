// ISO-1: tenant isolation, end to end, on loopback only. A full local stack: PG Cloud (next dev + fake KV/Brevo, cloud-dev.mjs),
// the relay (wrangler dev, temp copy) and three REAL controller binaries (pge2e build). Fake customers:
//   acme@acme.test    sites "Acer" + "HP" (two controllers)
//   mallory@mallory.test site "Mal" (one controller) — the attacker; she owns her controller and her licence token, and in some
//                steps she sits on acme's LAN (worst case)
//   beurs@beurs.test   site "Beurs" (licence only, no controller) — must never show up anywhere for the others
// Each tenant then tries to reach the others by every path; everything must be refused. All processes are stopped and the
// temp dir removed at the end. Nothing live is touched: every URL is 127.0.0.1 (console hosts are sent as a Host header
// to the local relay, never resolved).
//   PATH=~/dev/.tools/node/bin:~/dev/.tools/go/bin:$PATH node scripts/isolation-e2e.mjs
//   env CTL_DIR (default ~/.pg-work/ctl-iso), RELAY_DIR (default ~/.pg-work/relay-iso), KEEP=1 keeps the temp dir
// Note: the three controllers run on one machine, so they derive the SAME hardware ID. That is the strongest form of the
// "mallory registers acme's hardware ID on her own licence" attack, and the checks below rely on the site binding.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir, homedir, hostname } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { createHash, createPrivateKey } from 'node:crypto';
import { startDev, finishTwoStep, SITE, ORIGIN, ADMIN, MINT, H, RELAY_PORT } from './cloud-dev.mjs';

const CTL_DIR = process.env.CTL_DIR ?? path.join(homedir(), '.pg-work/ctl-iso');
const RELAY_DIR = process.env.RELAY_DIR ?? path.join(homedir(), '.pg-work/relay-iso');
const SUFFIX = `-console.localhost:${RELAY_PORT}`; // the relay's CONSOLE_HOST_SUFFIX in this run (Host header only)
const RELAY = `http://${H}:${RELAY_PORT}`;
const work = mkdtempSync(path.join(tmpdir(), 'pg-iso-e2e-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, step = 500) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn().catch(() => null); if (v) return v; await sleep(step); } return null; };
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra && !cond ? '  -> ' + extra : ''}`); cond ? pass++ : fail++; return cond; };
const refused = (s) => s >= 400 && s !== 429 && s < 500 || s === 404;
const procs = [];
let dev, relayLog = '';
const label = (id) => createHash('sha256').update(id).digest('hex').slice(0, 16);

// raw HTTP to the local relay with any Host header (a console host), never following redirects
function relayReq(hostHdr, p, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: H, port: RELAY_PORT, path: p, method, headers: { Host: hostHdr, ...headers } }, (res) => {
      let data = ''; res.on('data', (d) => (data += d)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}
// raw HTTP to a controller with a chosen Host header (a LAN name of that controller)
function ctlReq(port, hostHdr, p, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: H, port, path: p, method, headers: { Host: hostHdr, 'x-requested-with': 'XMLHttpRequest', ...headers } }, (res) => {
      let data = ''; res.on('data', (d) => (data += d)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

const cleanup = () => { for (const p of procs) { try { p.kill('SIGTERM'); } catch {} } dev?.stop(); };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { cleanup(); process.exit(1); });

try {
  // the pge2e controller build trusts only the committed lease TEST key (controller/testdata/e2e-signing), so the local
  // cloud signs with that one; it is a test fixture, never a production key
  dev = await startDev({ leaseKey: createPrivateKey(readFileSync(CTL_DIR + '/controller/testdata/e2e-signing/lease.testkey.pem')) });
  const j = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
  const sitePost = (p, body, headers = {}, method = 'POST') => fetch(SITE + p, { method, redirect: 'manual', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) }).then(j);
  const mailTo = async (to, n = 1) => until(async () => { const m = dev.mails.filter((x) => x.to === to); return m.length >= n ? m.at(-1) : null; }, 8000, 100);
  const signIn = async (email) => {
    const before = dev.mails.filter((x) => x.to === email).length;
    await sitePost('/api/auth/magic', { email });
    const m = await mailTo(email, before + 1);
    const link = m?.text.match(/https?:\/\/\S+\/api\/auth\/verify\?token=\w+/)?.[0];
    const v = await fetch(SITE + '/api/auth/verify', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN }, body: new URLSearchParams({ token: new URL(link).searchParams.get('token') }).toString() });
    return (await finishTwoStep(v, ORIGIN)).cookie;
  };
  const licOf = (id) => { const v = dev.kv.get('license:' + id); return v ? JSON.parse(v) : null; };

  console.log('setup: relay (wrangler dev, temp copy), controller binary');
  const rdir = path.join(work, 'relay'); cpSync(RELAY_DIR + '/src', rdir + '/src', { recursive: true }); cpSync(RELAY_DIR + '/wrangler.toml', rdir + '/wrangler.toml');
  symlinkSync(RELAY_DIR + '/node_modules', rdir + '/node_modules');
  // test only: no live routes in the temp copy, and no per-IP rate limit binding (it would throttle this script itself)
  writeFileSync(rdir + '/wrangler.toml', readFileSync(rdir + '/wrangler.toml', 'utf8').replace(/\[\[routes\]\][^[]*/g, '').replace(/\[\[unsafe\.bindings\]\][\s\S]*$/, ''));
  const relay = spawn(RELAY_DIR + '/node_modules/.bin/wrangler', ['dev', '--local', '--ip', H, '--port', String(RELAY_PORT), '--var', `CLOUD_BASE:${SITE}`, '--var', `MINT_SECRET:${MINT}`, '--var', `CONSOLE_HOST_SUFFIX:${SUFFIX}`],
    { cwd: rdir, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  relay.stdout.on('data', (d) => (relayLog += d)); relay.stderr.on('data', (d) => (relayLog += d)); procs.push(relay);
  const bin = path.join(work, 'pg-controller');
  execFileSync('go', ['build', '-tags', 'pge2e', '-o', bin, '.'], { cwd: CTL_DIR + '/controller', stdio: 'inherit' });
  ok('relay up (unknown controller token → 401)', (await until(async () => (await fetch(`${RELAY}/status/x`, { headers: { Authorization: 'Bearer ' + 'a'.repeat(32) } })).status === 401, 120000, 2000)) === true, relayLog.slice(-400));

  console.log('setup: admin creates the fake licences');
  const adminCookie = await signIn(ADMIN);
  const mk = async (email, name) => (await sitePost('/api/admin/licenses', { email, plan: 'pro', connector_limit: 5, expires_at: new Date(Date.now() + 365 * 864e5).toISOString(), site_name: name }, { cookie: adminCookie })).license?.id;
  const L = { acer: await mk('acme@acme.test', 'Acer'), hp: await mk('acme@acme.test', 'HP'), mal: await mk('mallory@mallory.test', 'Mal'), beurs: await mk('beurs@beurs.test', 'Beurs') };
  if (!ok('four licences created', Object.values(L).every(Boolean), JSON.stringify(L))) throw new Error('setup failed');

  console.log('setup: three real controllers on 127.0.0.1, each linked to its own site');
  const CT = {};
  for (const [key, port, email] of [['acer', 19191, 'acme@acme.test'], ['hp', 19192, 'acme@acme.test'], ['mal', 19193, 'mallory@mallory.test']]) {
    let log = '';
    const p = spawn(bin, ['-addr', `${H}:${port}`, '-db', path.join(work, key + '.db')], { cwd: work,
      env: { ...process.env, PG_CLOUD_URL: SITE, PG_RELAY_URL: `ws://${H}:${RELAY_PORT}`, PG_LEASE_PUBKEY: dev.rawPub, PG_E2E_NO_DISCOVERY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d)); procs.push(p);
    const C = `http://${H}:${port}`;
    await until(async () => (await fetch(C + '/api/auth/me')).status > 0, 30000);
    const cpost = (pp, body, cookie) => fetch(C + pp, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
    await cpost('/api/setup/admin', { username: 'owner', email: 'owner-' + key + '@example.test', password: 'Correct-horse-1', password2: 'Correct-horse-1' });
    const lg = await cpost('/api/auth/login', { username: 'owner', password: 'Correct-horse-1' });
    const ck = (lg.headers.get('set-cookie') ?? '').split(';')[0];
    const n0 = dev.mails.filter((x) => x.to === email).length;
    await cpost('/api/license/link-email', { email }, ck);
    const code = (await mailTo(email, n0 + 1))?.text.match(/code is: (\d{6})/)?.[1];
    await j(await cpost('/api/license/confirm-email', { code }, ck));
    const cl = await j(await cpost('/api/license/claim', { license_id: L[key] }, ck));
    CT[key] = { port, C, ck, cpost, log: () => log, proc: p };
    if (!ok(`controller ${key} linked to its own site`, cl.status === 'linked', JSON.stringify(cl).slice(0, 200))) throw new Error('setup failed: ' + log.slice(-400));
  }
  const tok = Object.fromEntries(Object.entries(L).map(([k, id]) => [k, licOf(id)?.token]));
  const statusOf = async (t) => j(await fetch(`${RELAY}/status/x`, { headers: { Authorization: 'Bearer ' + t } }));
  for (const k of ['acer', 'hp', 'mal']) ok(`relay tunnel of ${k} connected`, !!(await until(async () => /cloud relay: connected/.test(CT[k].log()) && (await statusOf(tok[k])).connected === true, 60000, 2000)), CT[k].log().slice(-300));

  console.log('setup: the tenants sign in to PG Cloud');
  const acme = await signIn('acme@acme.test'), mallory = await signIn('mallory@mallory.test');
  ok('acme and mallory have sessions', !!acme && !!mallory);

  // ─────────────────────────────────────────────────────────────── attacks
  console.log('\nA. portal: mallory reaches for acme\'s sites');
  const acct = await (await fetch(SITE + '/account', { headers: { cookie: mallory } })).text();
  ok('mallory\'s account page never names another tenant\'s site or licence', !/Acer|>HP<|Beurs/.test(acct) && !acct.includes(L.acer) && !acct.includes(L.beurs));
  for (const id of [L.acer, L.hp, L.beurs]) {
    const rs = await sitePost('/api/account/relay-session', { license_id: id }, { cookie: mallory });
    ok(`mallory asks a console link for another tenant's site → refused, no link`, refused(rs.status) && !rs.console_url, JSON.stringify(rs));
    const rn = await sitePost(`/api/account/sites/${id}`, { name: 'pwned' }, { cookie: mallory }, 'PATCH');
    ok('mallory renames it → refused, name unchanged', refused(rn.status) && licOf(id).site_name !== 'pwned', JSON.stringify(rn));
    const ac = await sitePost(`/api/account/sites/${id}/actions`, { action: 'release' }, { cookie: mallory });
    ok('mallory releases it → refused, still claimed', refused(ac.status) && (id === L.beurs || !!licOf(id).claimed_by), JSON.stringify(ac));
  }
  const own = await sitePost('/api/account/relay-session', { license_id: L.mal }, { cookie: mallory });
  ok('(control) mallory gets a console link for her own site', own.status === 200 && !!own.console_url, JSON.stringify(own));
  const acmeLink = await sitePost('/api/account/relay-session', { license_id: L.acer }, { cookie: acme });
  ok('(control) acme gets a console link for Acer', acmeLink.status === 200 && !!acmeLink.console_url, JSON.stringify(acmeLink));

  console.log('\nB. admin endpoints with mallory\'s (and acme\'s) session');
  for (const cookie of [mallory, acme]) {
    const who = cookie === mallory ? 'mallory' : 'acme';
    const calls = [
      ['GET', '/api/admin/licenses'], ['POST', '/api/admin/licenses', { email: 'mallory@mallory.test', plan: 'pro', connector_limit: 0 }],
      ['PATCH', `/api/admin/licenses/${L.acer}`, { status: 'revoked' }], ['DELETE', `/api/admin/licenses/${L.acer}`, { confirm: true }],
      ['POST', `/api/admin/licenses/${L.acer}/rotate-token`, {}], ['POST', `/api/admin/licenses/${L.acer}/release`, {}],
      ['DELETE', '/api/admin/tenants/acme%40acme.test', {}], ['GET', '/api/admin/export-csv'],
    ];
    for (const [m, p, b] of calls) {
      const r = await fetch(SITE + p, { method: m, redirect: 'manual', headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) });
      ok(`${who}: ${m} ${p.replace(/[0-9a-f-]{36}/, '<id>')} → refused`, refused(r.status), String(r.status));
    }
    const page = await fetch(SITE + '/admin', { headers: { cookie }, redirect: 'manual' });
    ok(`${who}: /admin page → redirect to login`, page.status >= 300 && page.status < 400, String(page.status));
  }
  ok('acme\'s licence is still active and claimed after all that', licOf(L.acer).status === 'active' && !!licOf(L.acer).claimed_by && licOf(L.acer).token === tok.acer);

  console.log('\nC. controller APIs with mallory\'s own licence token (she owns her box)');
  const bearer = (t, extra = {}) => ({ authorization: 'Bearer ' + t, 'content-type': 'application/json', ...extra });
  const cid = licOf(L.mal).claimed_by;
  const sites = await j(await fetch(SITE + '/api/cloud/sites', { headers: bearer(tok.mal, { 'x-controller-id': cid }) }));
  ok('GET /api/cloud/sites lists her own site only', sites.status === 200 && sites.sites?.length === 1 && sites.sites[0].id === L.mal, JSON.stringify(sites).slice(0, 200));
  for (const id of [L.acer, L.hp, L.beurs]) {
    const c = await j(await fetch(SITE + '/api/cloud/sites/console', { method: 'POST', headers: bearer(tok.mal, { 'x-controller-id': cid }), body: JSON.stringify({ site_id: id }) }));
    ok('POST /api/cloud/sites/console for another tenant\'s site → 404, no link', c.status === 404 && !c.console_url, JSON.stringify(c));
  }
  const before = JSON.parse(dev.kv.get('sitestatus:' + L.acer) ?? '{}');
  const forgedPower = () => ({ v: 1, state: 'ups', at: Math.floor(Date.now() / 1800000), s: 'b'.repeat(48), m: 'u'.repeat(48) }); // 24 h on battery
  // the cloud refuses heartbeats closer than 15 s, and her real controller beats every 60 s: retry until one gets in
  const hb = await until(async () => { const r = await j(await fetch(SITE + '/api/cloud/heartbeat', { method: 'POST', headers: bearer(tok.mal), body: JSON.stringify({ controller_id: cid, site_name: 'Acer', license_id: L.acer, devices: [{ name: 'pwned' }], power_24h: forgedPower() }) })); return r.status === 429 ? null : r; }, 90000, 3000) ?? {};
  const after = JSON.parse(dev.kv.get('sitestatus:' + L.acer) ?? '{}');
  ok('a heartbeat naming acme\'s site lands in mallory\'s own site only', hb.status === 200 && !JSON.stringify(after.devices ?? []).includes('pwned') && after.site_name === before.site_name, JSON.stringify(hb).slice(0, 160));
  ok('…its 24 h power summary (HIST-24H) does not land in acme\'s battery strip', after.power?.s !== 'b'.repeat(48) && !after.no_ups === !before.no_ups, JSON.stringify(after.power));
  // its first heartbeat may still be on its way (10 s after start, then every 60 s)
  const real = await until(async () => { const r = JSON.parse(dev.kv.get('sitestatus:' + L.acer) ?? '{}'); return r.no_ups === true || /[mb]/.test(r.power?.s ?? '') ? r : null; }, 90000, 2000) ?? {};
  ok('acme\'s real controller sends its own 24 h summary and the cloud took it (no UPS on this test box)', real.no_ups === true || /[mb]/.test(real.power?.s ?? ''), JSON.stringify({ no_ups: real.no_ups, power: real.power }));
  const rn = await j(await fetch(SITE + '/api/cloud/site', { method: 'PATCH', headers: bearer(tok.mal), body: JSON.stringify({ name: 'pwned', controller_id: cid, license_id: L.acer }) }));
  ok('a controller rename naming acme\'s site renames only her own', licOf(L.acer).site_name === 'Acer', JSON.stringify(rn));
  await fetch(SITE + '/api/cloud/site', { method: 'PATCH', headers: bearer(tok.mal), body: JSON.stringify({ name: 'Mal', controller_id: cid }) });
  const v = await j(await fetch(SITE + '/api/relay/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok.acer }) }));
  ok('relay validate (token → licence) without the relay secret → 401', v.status === 401 && !v.license_id);
  const st = await fetch(`${RELAY}/status/${L.acer}`);
  ok('relay status with acme\'s licence id instead of a token → 401', st.status === 401, String(st.status));

  console.log('\nD. the site switcher on the controllers');
  const ms = await j(await fetch(CT.mal.C + '/api/sites', { headers: { cookie: CT.mal.ck, 'x-requested-with': 'XMLHttpRequest' } }));
  ok('her switcher never lists acme\'s or beurs\' sites', ms.status === 200 && !/Acer|"HP"|Beurs/.test(JSON.stringify(ms)), JSON.stringify(ms).slice(0, 200));
  const mc = await j(await CT.mal.cpost('/api/sites/console', { id: L.acer }, CT.mal.ck));
  ok('her switcher cannot open Acer through the relay', !mc.console_url, JSON.stringify(mc));

  // a local viewer account on acme's Acer (e.g. an IT contractor) must not reach the owner's other site HP
  const nu = await CT.acer.cpost('/api/users', { username: 'contractor', email: 'contractor@example.test', password: 'Correct-horse-2', role: 'viewer' }, CT.acer.ck);
  const vl = await CT.acer.cpost('/api/auth/login', { username: 'contractor', password: 'Correct-horse-2' });
  const vck = (vl.headers.get('set-cookie') ?? '').split(';')[0];
  if (ok('a viewer account on acme\'s Acer signs in', nu.status < 300 && vl.status === 200 && !!vck, `${nu.status} ${vl.status}`)) {
    const vs = await j(await fetch(CT.acer.C + '/api/sites', { headers: { cookie: vck, 'x-requested-with': 'XMLHttpRequest' } }));
    ok('the viewer of Acer does not see the owner\'s other site HP', vs.status === 200 && !/"HP"/.test(JSON.stringify(vs)) && (vs.sites ?? []).length === 1, JSON.stringify(vs).slice(0, 200));
    const vc = await j(await CT.acer.cpost('/api/sites/console', { id: L.hp }, vck));
    ok('the viewer of Acer cannot open HP through the relay', !vc.console_url, JSON.stringify(vc));
    const as = await j(await fetch(CT.acer.C + '/api/sites', { headers: { cookie: CT.acer.ck, 'x-requested-with': 'XMLHttpRequest' } }));
    ok('(control) acme\'s admin on Acer sees Acer and HP', /"HP"/.test(JSON.stringify(as)), JSON.stringify(as).slice(0, 200));
  }

  console.log('\nE. licence claim from mallory\'s controller');
  const m0 = dev.mails.filter((x) => x.to === 'mallory@mallory.test').length;
  await CT.mal.cpost('/api/license/link-email', { email: 'mallory@mallory.test' }, CT.mal.ck);
  const mcode = (await mailTo('mallory@mallory.test', m0 + 1))?.text.match(/code is: (\d{6})/)?.[1];
  const ce = await j(await CT.mal.cpost('/api/license/confirm-email', { code: mcode }, CT.mal.ck));
  ok('the site choice offers her own site only', !JSON.stringify(ce).includes(L.acer) && !JSON.stringify(ce).includes(L.beurs), JSON.stringify(ce).slice(0, 200));
  const steal = await j(await CT.mal.cpost('/api/license/claim', { license_id: L.acer, transfer: true, acknowledge: true }, CT.mal.ck));
  ok('claiming acme\'s Acer from her controller → refused, Acer untouched', steal.status !== 'linked' && licOf(L.acer).token === tok.acer, JSON.stringify(steal));
  const n0 = dev.mails.length;
  const le = await j(await CT.mal.cpost('/api/license/link-email', { email: 'acme@acme.test' }, CT.mal.ck));
  await until(async () => dev.mails.length > n0, 5000, 100);
  const fresh = dev.mails.slice(n0);
  ok('linking to acme@acme.test sends the code to acme\'s mailbox only, never back to mallory', fresh.every((m) => m.to === 'acme@acme.test') && !/\b\d{6}\b/.test(JSON.stringify(le)), JSON.stringify(le) + ' ' + fresh.map((m) => m.to).join(','));
  const guess = await j(await CT.mal.cpost('/api/license/confirm-email', { code: '000000' }, CT.mal.ck));
  ok('a guessed code for acme@acme.test → refused, no site list', !guess.sites && guess.status !== 'choose', JSON.stringify(guess));

  console.log('\nF. relay: mallory\'s console token against acme\'s console host');
  const tm = own.console_url?.split('/console/')[1]?.replace(/\/$/, '');
  const ta = acmeLink.console_url?.split('/console/')[1]?.replace(/\/$/, '');
  const hostA = label(L.acer) + SUFFIX, hostM = label(L.mal) + SUFFIX;
  const shared = await relayReq(`${H}:${RELAY_PORT}`, '/console/' + tm);
  ok('the shared relay host only redirects to her own site host, no cookie', shared.status === 302 && (shared.headers.location ?? '').includes(label(L.mal)) && !shared.headers['set-cookie'], JSON.stringify(shared.headers));
  const ctrlAcme = await relayReq(hostA, '/console/' + ta);
  ok('(control) acme\'s token on acme\'s host → cookie set', ctrlAcme.status === 302 && /pg_relay=/.test(String(ctrlAcme.headers['set-cookie'])), `${ctrlAcme.status} ${ctrlAcme.body.slice(0, 120)}`);
  const ui = await relayReq(hostA, '/api/auth/me', { headers: { cookie: 'pg_relay=' + ta } });
  ok('(control) acme reaches the Acer controller through the relay (401 = its own login asks)', ui.status === 401 || ui.status === 200, `${ui.status} ${ui.body.slice(0, 120)}`);
  for (const [what, p, hdr] of [['/console/', '/console/' + tm, {}], ['/proxy/', '/proxy/' + tm + '/api/auth/me', {}], ['cookie', '/api/auth/me', { cookie: 'pg_relay=' + tm }]]) {
    const r = await relayReq(hostA, p, { headers: hdr });
    ok(`mallory's own token on acme's host via ${what} → 403`, r.status === 403, `${r.status} ${r.body.slice(0, 120)}`);
  }
  const stolen = await relayReq(hostM, '/api/auth/me', { headers: { cookie: 'pg_relay=' + ta } });
  ok('acme\'s token replayed on mallory\'s host (her controller would see it) → 403', stolen.status === 403, String(stolen.status));
  const [pl, sig] = (tm ?? 'x.y').split('.');
  const edited = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(pl, 'base64url').toString() || '{}'), do: L.acer })).toString('base64url') + '.' + sig;
  for (const h of [hostA, `${H}:${RELAY_PORT}`]) {
    const r = await relayReq(h, '/console/' + edited);
    ok(`her token edited to name Acer (on ${h === hostA ? 'acme\'s host' : 'the shared host'}) → 401`, r.status === 401, String(r.status));
  }
  const px = await relayReq(`${H}:${RELAY_PORT}`, '/proxy/' + tm + '/');
  ok('no controller page on the shared relay host (/proxy/ there → 404)', px.status === 404, String(px.status));
  const mint = await fetch(`${RELAY}/mint/${L.acer}`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Mint-Secret': 'guess' }, body: '{"scope":"customer","actor":"m"}' });
  ok('minting a token for Acer without the relay secret → 401', mint.status === 401, String(mint.status));

  console.log('\nG. CLOUD-SSO: mallory on acme\'s LAN, signed in to PG Cloud as herself');
  const lan = hostname().toLowerCase();
  if (!/^[a-z0-9-]{1,63}(\.local)?$/.test(lan)) {
    ok(`SSO leg skipped: this machine's host name (${lan}) is not a LAN name the flow accepts`, true);
  } else {
    const startOn = async (ct, cookieJar) => {
      const r = await ctlReq(ct.port, `${lan}:${ct.port}`, '/api/auth/sso/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: `https://${lan}:${ct.port}` }) });
      const bind = String(r.headers['set-cookie'] ?? '').match(/pg_sso=[^;]+/)?.[0];
      return { status: r.status, url: r.status === 200 ? JSON.parse(r.body).url : '', bind, cookieJar };
    };
    const authorize = async (startUrl, session) => {
      const q = new URL(startUrl).searchParams;
      const r = await fetch(SITE + '/sso/authorize', { method: 'POST', redirect: 'manual', headers: { cookie: session, origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ controller: q.get('controller'), nonce: q.get('nonce'), return: q.get('return') }).toString() });
      return { status: r.status, location: r.headers.get('location') ?? '' };
    };
    const deliver = async (ct, location, bind) => {
      const u = new URL(location);
      const r = await ctlReq(ct.port, `${lan}:${ct.port}`, u.pathname + u.search, { headers: bind ? { cookie: bind } : {} });
      return { status: r.status, session: /pg_session=[^;]{8,}/.test(String(r.headers['set-cookie'] ?? '')), body: r.body };
    };
    const s1 = await startOn(CT.acer);
    ok('mallory starts "Sign in with PowerGuardian Cloud" on acme\'s Acer (she is on its LAN)', s1.status === 200 && !!s1.bind, String(s1.status));
    const a1 = await authorize(s1.url, mallory);
    // the three test controllers share one hardware ID, so the cloud finds mallory's own site for "this" controller
    const stmt = a1.location.includes('assertion=') ? JSON.parse(Buffer.from(decodeURIComponent(a1.location.split('assertion=')[1]).split('.')[1], 'base64url').toString()) : null;
    ok('the cloud never signs a statement naming acme\'s site for mallory', !stmt || (stmt.site_id === L.mal && stmt.email === 'mallory@mallory.test'), JSON.stringify(stmt));
    if (a1.location.includes('assertion=')) {
      const d1 = await deliver(CT.acer, a1.location, s1.bind);
      ok('acme\'s controller refuses mallory\'s statement (another site), no session', !d1.session && /another site/.test(d1.body), `${d1.status} ${d1.body.slice(0, 200)}`);
    }
    const s2 = await startOn(CT.acer);
    const a2 = await authorize(s2.url, acme);
    const d2 = await deliver(CT.acer, a2.location, s2.bind);
    ok('(control) acme signs in to Acer with PowerGuardian Cloud', a2.status === 303 && d2.session, `${a2.status} ${d2.status} ${d2.body.slice(0, 160)}`);
    const s3 = await startOn(CT.hp);
    const a3 = await authorize(s3.url, acme);
    const d3 = await deliver(CT.acer, a3.location, s2.bind);
    ok('a statement acme got for HP is refused by Acer (other site / other nonce)', !d3.session, `${d3.status} ${d3.body.slice(0, 160)}`);
    const d4 = await deliver(CT.acer, a2.location, s2.bind);
    ok('a used statement replayed on Acer → refused', !d4.session, String(d4.status));
    const s5 = s3; // any started flow will do: the cloud refuses the return address before it looks at the nonce
    const evil = `https://${label(L.mal)}-console.powerguardian.cloud/api/auth/sso/callback`;
    const q = new URL(s5.url).searchParams;
    const a5 = await fetch(SITE + '/sso/authorize', { method: 'POST', redirect: 'manual', headers: { cookie: acme, origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ controller: q.get('controller'), nonce: q.get('nonce'), return: evil }).toString() });
    ok('acme\'s statement can never be sent to mallory\'s console origin', a5.status === 400 && !a5.headers.get('location'), String(a5.status));
  }

  console.log('\nH. AUTO-SSO: Open Console lands the owner signed in on the controller (no login form, no Continue tap)');
  {
    // the browser on a console host, as the relay sees it: Host = the site's console host (local suffix), the page's own
    // origin = the production console host (what the controller and the cloud check; the relay hides the host)
    const prodHost = (id) => `${label(id)}-console.powerguardian.cloud`;
    // a proxy may fold several Set-Cookie headers into one comma-joined line: split them again before each "name="
    const cookiesOf = (res) => [].concat(res.headers['set-cookie'] ?? res.headers.getSetCookie?.() ?? []).flatMap((c) => String(c).split(/,(?=\s*[A-Za-z0-9_-]+=)/)).map((c) => c.trim().split(';')[0]);
    const openConsole = async (session, id) => {
      const r = await fetch(SITE + '/api/account/relay-session', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: session }, body: JSON.stringify({ license_id: id }) });
      const body = await r.json().catch(() => ({}));
      return { status: r.status, url: body.console_url ?? '', intent: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pg_ci_')) ?? '' };
    };
    const enter = async (id, consoleUrl) => {
      const t = consoleUrl.split('/console/')[1]?.replace(/\/$/, '');
      const r = await relayReq(label(id) + SUFFIX, '/console/' + t);
      return cookiesOf(r).find((c) => c.startsWith('pg_relay=')) ?? '';
    };
    // every request here comes from 127.0.0.1, so the controller's per-IP limit on /api/auth/ (10 a minute) is shared by
    // all steps of this script: wait the window out on a 429 instead of failing (one browser stays far below it)
    const viaRelay = async (id, jar, p, opt = {}) => {
      for (let i = 0; ; i++) {
        const r = await relayReq(label(id) + SUFFIX, p, { ...opt, headers: { 'x-requested-with': 'XMLHttpRequest', ...(opt.headers ?? {}), cookie: [...jar, opt.headers?.cookie].filter(Boolean).join('; ') } });
        if (r.status !== 429 || i >= 2) return r;
        await sleep(61000);
      }
    };
    const start = async (id, jar) => {
      const r = await viaRelay(id, jar, '/api/auth/sso/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: `https://${prodHost(id)}` }) });
      return { status: r.status, url: r.status === 200 ? JSON.parse(r.body).url : '', bind: cookiesOf(r).find((c) => c.startsWith('pg_sso=')) ?? '' };
    };
    const authorizeGet = async (startUrl, cookies) => {
      const u = new URL(startUrl);
      const r = await fetch(SITE + '/sso/authorize' + u.search, { redirect: 'manual', headers: { cookie: cookies.filter(Boolean).join('; '), 'sec-fetch-site': 'same-site' } });
      return { status: r.status, location: r.headers.get('location') ?? '', body: await r.text() };
    };

    const oc = await openConsole(acme, L.acer);
    ok('acme taps Open Console for Acer: a console link and a console intent', oc.status === 200 && !!oc.url && oc.intent.startsWith(`pg_ci_${label(L.acer)}=`), JSON.stringify(oc));
    const relayCk = await enter(L.acer, oc.url);
    ok('the console link opens Acer through the relay', !!relayCk);
    const st = JSON.parse((await viaRelay(L.acer, [relayCk], '/api/auth/sso/status')).body || '{}');
    const bs = JSON.parse((await viaRelay(L.acer, [relayCk], '/api/bootstrap')).body || '{}');
    ok('Acer says: through the console, not signed in → start the cloud sign-in by itself', st.available === true && st.auto === true && bs.authenticated === false && bs.sso_auto === true, JSON.stringify({ st, bs: { a: bs.authenticated, s: bs.sso_auto } }));
    const lanSt = JSON.parse((await ctlReq(CT.acer.port, `127.0.0.1:${CT.acer.port}`, '/api/auth/sso/status')).body || '{}');
    ok('(control) on the LAN the same controller does not start it by itself', lanSt.auto !== true, JSON.stringify(lanSt));
    const s1 = await start(L.acer, [relayCk]);
    ok('the page starts the flow through the relay with the console origin', s1.status === 200 && !!s1.bind && new URL(s1.url).searchParams.get('return') === `https://${prodHost(L.acer)}/api/auth/sso/callback`, `${s1.status} ${s1.url}`);
    const a1 = await authorizeGet(s1.url, [acme, oc.intent]);
    ok('PG Cloud completes without the Continue page (owner, two-step session, fresh intent)', a1.status === 303 && a1.location.startsWith(`https://${prodHost(L.acer)}/api/auth/sso/callback?assertion=`), `${a1.status} ${a1.location.slice(0, 120)} ${a1.body.slice(0, 160)}`);
    let sess = '';
    if (a1.location) {
      const cb = new URL(a1.location);
      const d1 = await viaRelay(L.acer, [relayCk, s1.bind], cb.pathname + cb.search);
      sess = cookiesOf(d1).find((c) => /^pg_session=.{8,}/.test(c)) ?? '';
      ok('back on Acer\'s console host the controller starts a session (no TOTP: the cloud passed two-step)', !!sess && !/pending|sso=mfa/.test(d1.body), `${d1.status} ${JSON.stringify(d1.headers['set-cookie'])} ${d1.body.slice(0, 160)}`);
    }
    const me = sess ? JSON.parse((await viaRelay(L.acer, [relayCk, sess], '/api/auth/me')).body || '{}') : {};
    ok('acme lands signed in on Acer', !!me.username && /admin|owner/.test(me.role ?? ''), JSON.stringify(me));

    const s2 = await start(L.acer, [relayCk]);
    const a2 = await authorizeGet(s2.url, [acme, oc.intent]);
    ok('the same console intent replayed → the Continue page, no statement', a2.status === 200 && a2.body.includes('id="sso-continue"') && !a2.location, `${a2.status} ${a2.location.slice(0, 80)}`);
    console.log('   site switcher: on Acer tap HP → signed in on HP');
    {
      const cidAcer = licOf(L.acer).claimed_by, cidMal = licOf(L.mal).claimed_by;
      // what Acer's controller sends for its admin linked to acme (the controller side is in controller/sites_api_test.go;
      // here the local relay's console links would not pass its exact console-host check)
      const askCloud = (t, cid, body) => fetch(SITE + '/api/cloud/sites/console', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'x-controller-id': cid, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j);
      const sw = await askCloud(tok.acer, cidAcer, { site_id: L.hp, actor: 'acme@acme.test' });
      ok('Acer asks the cloud for HP for its admin linked to acme: console link + switch ticket', sw.status === 200 && !!sw.console_url && (sw.open_url ?? '').startsWith(SITE + '/console/open?t='), JSON.stringify(sw));
      const plain = await askCloud(tok.acer, cidAcer, { site_id: L.hp });
      ok('a local admin without a cloud link: the console link only (HP asks its own login)', plain.status === 200 && !plain.open_url, JSON.stringify(plain));
      const toMal = await askCloud(tok.acer, cidAcer, { site_id: L.mal, actor: 'acme@acme.test' });
      ok('acme\'s controller switching to mallory\'s site → refused, no link, no ticket', toMal.status === 404 && !toMal.console_url && !toMal.open_url, JSON.stringify(toMal));
      const asAcme = await askCloud(tok.mal, cidMal, { site_id: L.hp, actor: 'acme@acme.test' });
      ok('mallory\'s controller naming acme as actor for HP → refused, no ticket', asAcme.status === 404 && !asAcme.open_url, JSON.stringify(asAcme));
      if (sess) {
        const viaCtl = JSON.parse((await viaRelay(L.acer, [relayCk, sess], '/api/sites/console', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: L.mal }) })).body || '{}');
        ok('acme signed in on Acer, the switcher asking for Mal → refused, no link', !viaCtl.console_url && !viaCtl.open_url, JSON.stringify(viaCtl));
      }
      const openT = (cookie) => fetch(sw.open_url, { redirect: 'manual', headers: cookie ? { cookie } : {} });
      const o0 = await openT('');
      ok('the ticket without a cloud session → sign in to PG Cloud first, then on to HP', o0.status === 303 && o0.headers.get('location') === '/login?next=console' && /pg_open_next=/.test(o0.headers.get('set-cookie') ?? ''), String(o0.status));
      const om = await openT(mallory);
      ok('mallory\'s cloud session on acme\'s ticket → refused, no redirect to HP', om.status === 403 && !om.headers.get('location'), String(om.status));
      const oa = await openT(acme);
      const hpConsoleUrl = oa.headers.get('location') ?? '';
      const hpIntent = (oa.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith(`pg_ci_${label(L.hp)}=`)) ?? '';
      ok('acme\'s session on the ticket → HP\'s console link with HP\'s console intent', oa.status === 303 && hpConsoleUrl.includes('/console/') && !!hpIntent, `${oa.status} ${hpConsoleUrl}`);
      const again = await openT(acme);
      ok('the ticket replayed → expired, no second link', again.status === 410 && !again.headers.get('location'), String(again.status));
      if (hpConsoleUrl && hpIntent) {
        const hpRelay = await enter(L.hp, hpConsoleUrl);
        const sh = await start(L.hp, [hpRelay]);
        const ah = await authorizeGet(sh.url, [acme, hpIntent]);
        ok('HP starts the cloud sign-in by itself and PG Cloud completes without Continue', ah.status === 303 && ah.location.startsWith(`https://${prodHost(L.hp)}/api/auth/sso/callback?assertion=`), `${ah.status} ${ah.body.slice(0, 120)}`);
        if (ah.location) {
          const cb = new URL(ah.location);
          const dh = await viaRelay(L.hp, [hpRelay, sh.bind], cb.pathname + cb.search);
          const hs = cookiesOf(dh).find((c) => /^pg_session=.{8,}/.test(c)) ?? '';
          const meHp = hs ? JSON.parse((await viaRelay(L.hp, [hpRelay, hs], '/api/auth/me')).body || '{}') : {};
          ok('acme lands signed in on HP (switched from Acer, no login)', !!meHp.username && /admin|owner/.test(meHp.role ?? ''), `${dh.status} ${JSON.stringify(meHp)}`);
        }
      }
    }
    console.log('   site switcher on the LAN (e.g. the controller\'s home-screen app): on Acer tap HP → HP\'s LAN address, signed in');
    {
      const cidAcer = licOf(L.acer).claimed_by, cidMal = licOf(L.mal).claimed_by;
      const askCloud = (t, cid, body) => fetch(SITE + '/api/cloud/sites/console', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'x-controller-id': cid, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j);
      const hpLan = (JSON.parse(dev.kv.get('sitestatus:' + L.hp) ?? '{}').lan ?? []).find((a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a));
      const noTicket = await askCloud(tok.acer, cidAcer, { site_id: L.hp, via: 'lan' });
      ok('via lan without a linked cloud account → no ticket (the page opens the LAN address directly)', noTicket.status === 403 && !noTicket.open_url, JSON.stringify(noTicket));
      const malLan = await askCloud(tok.mal, cidMal, { site_id: L.hp, actor: 'acme@acme.test', via: 'lan' });
      ok('mallory\'s controller asking a LAN ticket for acme\'s HP → refused', malLan.status === 404 && !malLan.open_url, JSON.stringify(malLan));
      const toMalLan = await askCloud(tok.acer, cidAcer, { site_id: L.mal, actor: 'acme@acme.test', via: 'lan' });
      ok('acme\'s controller asking a LAN ticket for mallory\'s site → refused', toMalLan.status === 404 && !toMalLan.open_url, JSON.stringify(toMalLan));
      if (!hpLan) {
        ok('LAN leg skipped: HP reported no private LAN address on this machine', true);
      } else {
        const lt = await askCloud(tok.acer, cidAcer, { site_id: L.hp, actor: 'acme@acme.test', via: 'lan' });
        ok('Acer asks a LAN ticket for HP for its admin linked to acme: an open_url only', lt.status === 200 && (lt.open_url ?? '').startsWith(SITE + '/console/open?t=') && !lt.console_url, JSON.stringify(lt));
        const om = await fetch(lt.open_url, { redirect: 'manual', headers: { cookie: mallory } });
        ok('mallory\'s cloud session on that ticket → refused', om.status === 403 && !om.headers.get('location'), String(om.status));
        const oa = await fetch(lt.open_url, { redirect: 'manual', headers: { cookie: acme } });
        const intent = (oa.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith(`pg_ci_${label(L.hp)}=`)) ?? '';
        ok('acme\'s session → HP\'s own reported LAN address with ?sso=auto and HP\'s console intent', oa.status === 303 && oa.headers.get('location') === `https://${hpLan}/?sso=auto` && !!intent, `${oa.status} ${oa.headers.get('location')}`);
        // the browser on HP's LAN address (this machine: the port of the HP test controller)
        const lanReq = async (p, opt = {}) => {
          for (let i = 0; ; i++) { const r = await ctlReq(CT.hp.port, `${hpLan}:${CT.hp.port}`, p, opt); if (r.status !== 429 || i >= 2) return r; await sleep(61000); }
        };
        // the three test controllers share this machine and so report the SAME LAN address; on a real LAN each site
        // reports its own. Give Acer (and Mal) another address in the fake KV for this leg, so HP's address is HP's.
        for (const k of [L.acer, L.mal]) { const v = JSON.parse(dev.kv.get('sitestatus:' + k) ?? '{}'); dev.kv.set('sitestatus:' + k, JSON.stringify({ ...v, lan: ['10.255.255.' + (k === L.acer ? 1 : 2)] })); }
        const st = await lanReq('/api/auth/sso/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: `https://${hpLan}:${CT.hp.port}` }) });
        const url = st.status === 200 ? JSON.parse(st.body).url : '';
        const bind = cookiesOf(st).find((c) => c.startsWith('pg_sso=')) ?? '';
        const ah = url ? await authorizeGet(url, [acme, intent]) : { status: st.status, location: '', body: st.body };
        ok('HP (LAN) starts the cloud sign-in by itself; PG Cloud completes without Continue to HP\'s reported address', ah.status === 303 && ah.location.startsWith(`https://${hpLan}:${CT.hp.port}/api/auth/sso/callback?assertion=`), `${ah.status} ${ah.location.slice(0, 100)} ${ah.body.slice(0, 120)}`);
        if (ah.location) {
          const cb = new URL(ah.location);
          const d = await lanReq(cb.pathname + cb.search, { headers: { cookie: bind } });
          const hs = cookiesOf(d).find((c) => /^pg_session=.{8,}/.test(c)) ?? '';
          const me = hs ? JSON.parse((await lanReq('/api/auth/me', { headers: { cookie: hs } })).body || '{}') : {};
          ok('acme lands signed in on HP at its LAN address (no login)', !!me.username && /admin|owner/.test(me.role ?? ''), `${d.status} ${JSON.stringify(me)}`);
        }
        const st2 = await lanReq('/api/auth/sso/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: `https://${hpLan}:${CT.hp.port}` }) });
        const a2 = st2.status === 200 ? await authorizeGet(JSON.parse(st2.body).url, [acme, intent]) : { status: 0, location: '' };
        ok('the LAN intent replayed → Continue page, not silent', a2.status === 200 && !a2.location, String(a2.status));
      }
    }
    if (sess) await viaRelay(L.acer, [relayCk, sess], '/api/auth/logout', { method: 'POST' });
    const s3 = await start(L.acer, [relayCk]);
    const a3 = await authorizeGet(s3.url, [acme]);
    ok('after signing out on the controller a new try is not silent (Continue page): no sign-in loop', a3.status === 200 && a3.body.includes('id="sso-continue"'), String(a3.status));
    const hpConsole = await openConsole(acme, L.hp);
    const s4 = await start(L.acer, [relayCk]);
    const a4 = await authorizeGet(s4.url, [acme, hpConsole.intent.replace(`pg_ci_${label(L.hp)}`, `pg_ci_${label(L.acer)}`)]);
    ok('an intent acme got for HP, put under Acer\'s name → Continue page, not silent', a4.status === 200 && !a4.location, `${a4.status} ${a4.location.slice(0, 80)}`);

    const mo = await openConsole(mallory, L.mal);
    ok('(control) mallory gets her own console link and intent for Mal', mo.status === 200 && !!mo.intent, JSON.stringify(mo));
    for (const [what, cookies] of [['her own intent for Mal', [mallory, mo.intent]], ['her intent renamed to Acer', [mallory, mo.intent.replace(`pg_ci_${label(L.mal)}`, `pg_ci_${label(L.acer)}`)]], ['no intent', [mallory]]]) {
      const sm = await start(L.acer, [relayCk]);
      const am = await authorizeGet(sm.url, cookies);
      ok(`mallory (cloud session) on acme's Acer console flow with ${what} → refused, no statement`, am.status >= 400 && am.status < 500 && !am.location, `${am.status} ${am.location.slice(0, 80)}`);
    }
    const acmeAgain = await openConsole(acme, L.acer);
    const s5 = await start(L.acer, [relayCk]);
    const a5 = await authorizeGet(s5.url, [mallory, acmeAgain.intent]);
    ok('mallory holding acme\'s intent cookie (bound to acme\'s session) → refused, no statement', a5.status >= 400 && !a5.location, `${a5.status} ${a5.location.slice(0, 80)}`);
  }
} catch (e) { console.log(' FAIL  script error', e); fail++; }
finally {
  cleanup();
  await sleep(500);
  if (!process.env.KEEP) { try { rmSync(work, { recursive: true, force: true }); } catch {} }
  console.log(`\n${pass} passed, ${fail} failed${process.env.KEEP ? '  (kept ' + work + ')' : ''}`);
  if (fail) console.log('--- relay requests ---\n' + relayLog.split('\n').filter((l) => /\[wrangler:info\] (GET|POST|PUT|PATCH|DELETE)|error|Error/.test(l)).slice(-60).join('\n'));
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
}
