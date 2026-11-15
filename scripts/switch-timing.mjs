// FAST-SWITCH: where the time goes when the site switcher on Acer (opened through the relay) opens HP. The same local
// stack as isolation-e2e.mjs (PG Cloud next dev + fake KV, the relay in wrangler dev, two REAL controllers on loopback),
// then every hop a browser makes is timed and its bytes counted. Hops marked [tunnel] travel through a controller's
// relay tunnel (WebSocket, body base64): on a real site that leg is the site's own uplink.
//   PATH=~/dev/.tools/node/bin:$PATH node scripts/switch-timing.mjs
//   env CTL_DIR (default ~/.pg-work/ctl-iso), RELAY_DIR (default ~/.pg-work/relay-iso), RUNS (default 3), UPLINK_MBIT (default 10)
// Nothing live is touched: every URL is 127.0.0.1.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { createHash, createPrivateKey } from 'node:crypto';
import { startDev, finishTwoStep, SITE, ORIGIN, MINT, H, RELAY_PORT, ADMIN } from './cloud-dev.mjs';

const CTL_DIR = process.env.CTL_DIR ?? path.join(homedir(), '.pg-work/ctl-iso');
const RELAY_DIR = process.env.RELAY_DIR ?? path.join(homedir(), '.pg-work/relay-iso');
const RUNS = Number(process.env.RUNS ?? 3), UPLINK = Number(process.env.UPLINK_MBIT ?? 10);
const SUFFIX = `-console.localhost:${RELAY_PORT}`;
const RELAY = `http://${H}:${RELAY_PORT}`;
const work = mkdtempSync(path.join(tmpdir(), 'pg-switch-timing-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, step = 500) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn().catch(() => null); if (v) return v; await sleep(step); } return null; };
const label = (id) => createHash('sha256').update(id).digest('hex').slice(0, 16);
const prodHost = (id) => `${label(id)}-console.powerguardian.cloud`;
const procs = []; let dev;
const cookiesOf = (res) => [].concat(res.headers['set-cookie'] ?? res.headers.getSetCookie?.() ?? []).flatMap((c) => String(c).split(/,(?=\s*[A-Za-z0-9_-]+=)/)).map((c) => c.trim().split(';')[0]);
function relayReq(hostHdr, p, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: H, port: RELAY_PORT, path: p, method, headers: { Host: hostHdr, ...headers } }, (res) => {
      const chunks = []; res.on('data', (d) => chunks.push(d)); res.on('end', () => { const z = Buffer.concat(chunks); const b = /gzip/.test(res.headers['content-encoding'] ?? '') ? gunzipSync(z) : z; resolve({ status: res.statusCode, headers: res.headers, body: b.toString(), bytes: b.length, wire: z.length }); });
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}
const cleanup = () => { for (const p of procs) { try { p.kill('SIGTERM'); } catch {} } dev?.stop(); };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { cleanup(); process.exit(1); });

try {
  dev = await startDev({ leaseKey: createPrivateKey(readFileSync(CTL_DIR + '/controller/testdata/e2e-signing/lease.testkey.pem')) });
  const j = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
  const sitePost = (p, body, headers = {}) => fetch(SITE + p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) }).then(j);
  const mailTo = async (to, n = 1) => until(async () => { const m = dev.mails.filter((x) => x.to === to); return m.length >= n ? m.at(-1) : null; }, 8000, 100);
  const signIn = async (email) => {
    const before = dev.mails.filter((x) => x.to === email).length;
    await sitePost('/api/auth/magic', { email });
    const link = (await mailTo(email, before + 1))?.text.match(/https?:\/\/\S+\/api\/auth\/verify\?token=\w+/)?.[0];
    const v = await fetch(SITE + '/api/auth/verify', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN }, body: new URLSearchParams({ token: new URL(link).searchParams.get('token') }).toString() });
    return (await finishTwoStep(v, ORIGIN)).cookie;
  };
  const licOf = (id) => JSON.parse(dev.kv.get('license:' + id) ?? 'null');

  const rdir = path.join(work, 'relay'); cpSync(RELAY_DIR + '/src', rdir + '/src', { recursive: true }); cpSync(RELAY_DIR + '/wrangler.toml', rdir + '/wrangler.toml');
  symlinkSync(RELAY_DIR + '/node_modules', rdir + '/node_modules');
  writeFileSync(rdir + '/wrangler.toml', readFileSync(rdir + '/wrangler.toml', 'utf8').replace(/\[\[routes\]\][^[]*/g, '').replace(/\[\[unsafe\.bindings\]\][\s\S]*$/, ''));
  let relayLog = '';
  const relay = spawn(RELAY_DIR + '/node_modules/.bin/wrangler', ['dev', '--local', '--ip', H, '--port', String(RELAY_PORT), '--var', `CLOUD_BASE:${SITE}`, '--var', `MINT_SECRET:${MINT}`, '--var', `CONSOLE_HOST_SUFFIX:${SUFFIX}`],
    { cwd: rdir, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  relay.stdout.on('data', (d) => (relayLog += d)); relay.stderr.on('data', (d) => (relayLog += d)); procs.push(relay);
  const bin = path.join(work, 'pg-controller');
  execFileSync('go', ['build', '-tags', 'pge2e', '-o', bin, '.'], { cwd: CTL_DIR + '/controller', stdio: 'inherit' });
  await until(async () => (await fetch(`${RELAY}/status/x`, { headers: { Authorization: 'Bearer ' + 'a'.repeat(32) } })).status === 401, 120000, 2000);

  const adminCookie = await signIn(ADMIN);
  const mk = async (name) => (await sitePost('/api/admin/licenses', { email: 'acme@acme.test', plan: 'pro', connector_limit: 5, expires_at: new Date(Date.now() + 365 * 864e5).toISOString(), site_name: name }, { cookie: adminCookie })).license?.id;
  const L = { acer: await mk('Acer'), hp: await mk('HP') };
  const CT = {};
  for (const [key, port] of [['acer', 19191], ['hp', 19192]]) {
    let log = '';
    const p = spawn(bin, ['-addr', `${H}:${port}`, '-db', path.join(work, key + '.db')], { cwd: work,
      env: { ...process.env, PG_CLOUD_URL: SITE, PG_RELAY_URL: `ws://${H}:${RELAY_PORT}`, PG_LEASE_PUBKEY: dev.rawPub, PG_E2E_NO_DISCOVERY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d)); procs.push(p);
    const C = `http://${H}:${port}`;
    await until(async () => (await fetch(C + '/api/auth/me')).status > 0, 30000);
    const cpost = (pp, body, cookie) => fetch(C + pp, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
    await cpost('/api/setup/admin', { username: 'owner', email: 'owner-' + key + '@example.test', password: 'Correct-horse-1', password2: 'Correct-horse-1' });
    const ck = ((await cpost('/api/auth/login', { username: 'owner', password: 'Correct-horse-1' })).headers.get('set-cookie') ?? '').split(';')[0];
    const n0 = dev.mails.filter((x) => x.to === 'acme@acme.test').length;
    await cpost('/api/license/link-email', { email: 'acme@acme.test' }, ck);
    const code = (await mailTo('acme@acme.test', n0 + 1))?.text.match(/code is: (\d{6})/)?.[1];
    await cpost('/api/license/confirm-email', { code }, ck);
    const cl = await j(await cpost('/api/license/claim', { license_id: L[key] }, ck));
    if (cl.status !== 'linked') throw new Error(key + ' not linked: ' + JSON.stringify(cl) + log.slice(-300));
    await cpost('/api/wizard/complete', {}, ck); // a site in use (setup done), like the real HP and Acer
    CT[key] = { log: () => log };
  }
  const tok = (k) => licOf(L[k])?.token;
  for (const k of ['acer', 'hp']) await until(async () => /cloud relay: connected/.test(CT[k].log()) && (await j(await fetch(`${RELAY}/status/x`, { headers: { Authorization: 'Bearer ' + tok(k) } }))).connected === true, 60000, 2000);
  const acme = await signIn('acme@acme.test');
  // HP online for the cloud (its first heartbeat)
  await until(async () => (await fetch(SITE + '/api/cloud/sites/console', { method: 'POST', headers: { authorization: 'Bearer ' + tok('acer'), 'x-controller-id': licOf(L.acer).claimed_by, 'content-type': 'application/json' }, body: JSON.stringify({ site_id: L.hp }) })).status === 200, 120000, 2000);

  // a browser on a site's console host
  const viaRelay = async (id, jar, p, opt = {}) => {
    for (let i = 0; ; i++) {
      const r = await relayReq(label(id) + SUFFIX, p, { ...opt, headers: { 'x-requested-with': 'XMLHttpRequest', 'accept-encoding': 'gzip', ...(opt.headers ?? {}), cookie: jar.filter(Boolean).join('; ') } });
      if (r.status !== 429 || i >= 2) return r;
      console.log('   (429 from the controller\'s 10/min /api/auth/ limit: waiting the window out)'); await sleep(61000);
    }
  };
  const enter = async (id, consoleUrl) => { const t = consoleUrl.split('/console/')[1]; const r = await relayReq(label(id) + SUFFIX, '/console/' + t); return { r, ck: cookiesOf(r).find((c) => c.startsWith('pg_relay=')) ?? '' }; };
  const ssoSignIn = async (id, relayCk, intent) => {
    const st = await viaRelay(id, [relayCk], '/api/auth/sso/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: `https://${prodHost(id)}` }) });
    const url = JSON.parse(st.body).url, bind = cookiesOf(st).find((c) => c.startsWith('pg_sso=')) ?? '';
    const a = await fetch(SITE + '/sso/authorize' + new URL(url).search, { redirect: 'manual', headers: { cookie: [acme, intent].filter(Boolean).join('; '), 'sec-fetch-site': 'same-site' } });
    const cb = new URL(a.headers.get('location'));
    const d = await viaRelay(id, [relayCk, bind], cb.pathname + cb.search);
    return cookiesOf(d).find((c) => /^pg_session=.{8,}/.test(c)) ?? '';
  };
  // acme on Acer through Open Console (this also links Acer's "owner" to acme: AUTO-SSO actor)
  const oc = await fetch(SITE + '/api/account/relay-session', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: acme }, body: JSON.stringify({ license_id: L.acer }) });
  const ocUrl = (await oc.json()).console_url, ocIntent = (oc.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('pg_ci_')) ?? '';
  const acerCk = (await enter(L.acer, ocUrl)).ck;
  const acerSess = await ssoSignIn(L.acer, acerCk, ocIntent);
  if (!acerSess) throw new Error('acme not signed in on Acer');

  const rows = [];
  const hop = async (name, where, fn) => { const t = performance.now(); const r = await fn(); const ms = performance.now() - t; rows.push({ name, where, ms, bytes: r?.bytes ?? 0 }); return r; };
  const b64 = (n) => Math.ceil(n / 3) * 4;
  for (let run = 0; run <= RUNS; run++) {
    if (run > 0) await sleep(61000); // the controllers' 10/min /api/auth/ limit per address (every request here is 127.0.0.1)
    rows.length = 0;
    const t0 = performance.now();
    // 1. the tap: Acer asks the cloud for HP (relay tunnel of Acer → Acer → cloud → relay mint)
    const sw = await hop('Acer: POST /api/sites/console', 'tunnel Acer + cloud', () => viaRelay(L.acer, [acerCk, acerSess], '/api/sites/console', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: L.hp }) }));
    let openUrl = JSON.parse(sw.body || '{}').open_url;
    if (!openUrl) { // 0.1.118 against the local relay: its console link fails the exact host check; time the cloud call itself
      const cid = licOf(L.acer).claimed_by;
      const c = await hop('  (cloud: /api/cloud/sites/console direct)', 'cloud', async () => { const r = await fetch(SITE + '/api/cloud/sites/console', { method: 'POST', headers: { authorization: 'Bearer ' + tok('acer'), 'x-controller-id': cid, 'content-type': 'application/json' }, body: JSON.stringify({ site_id: L.hp, actor: 'acme@acme.test' }) }); const b = await r.text(); return { body: b, bytes: b.length }; });
      openUrl = JSON.parse(c.body).open_url;
      if (!openUrl) throw new Error('no switch ticket: controller ' + sw.status + ' ' + sw.body.slice(0, 200) + ' / cloud ' + c.body.slice(0, 200));
    }
    // 2. the browser on PG Cloud: the switch ticket → HP's console link (burn, relay mint, console intent)
    const o = await hop('cloud: GET /console/open?t=', 'cloud', async () => { const r = await fetch(openUrl, { redirect: 'manual', headers: { cookie: acme } }); return { status: r.status, location: r.headers.get('location'), set: r.headers.getSetCookie(), bytes: 0 }; });
    const hpIntent = o.set.map((c) => c.split(';')[0]).find((c) => c.startsWith(`pg_ci_${label(L.hp)}=`)) ?? '';
    // 3. HP's console host: the relay sets pg_relay and redirects to /
    const e = await hop('relay: GET /console/<token> → 302', 'relay', () => enter(L.hp, o.location).then((x) => ({ ...x, bytes: 0 })));
    const loc = e.r.headers.location || '/';
    // 4. the landing page on HP (not signed in yet)
    const land = await hop(`HP: GET ${loc} (not signed in yet)`, 'tunnel HP', () => viaRelay(L.hp, [e.ck], loc));
    // the whole app asks bootstrap and sso/status before it starts the sign-in; the FAST-SWITCH landing page does not
    if (land.bytes > 100_000) {
      await hop('HP: GET /api/bootstrap', 'tunnel HP', () => viaRelay(L.hp, [e.ck], '/api/bootstrap'));
      await hop('HP: GET /api/auth/sso/status', 'tunnel HP', () => viaRelay(L.hp, [e.ck], '/api/auth/sso/status'));
    } else rows.at(-1).name += ' = landing page';
    const st = await hop('HP: POST /api/auth/sso/start', 'tunnel HP', () => viaRelay(L.hp, [e.ck], '/api/auth/sso/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: `https://${prodHost(L.hp)}` }) }));
    const url = JSON.parse(st.body).url, bind = cookiesOf(st).find((c) => c.startsWith('pg_sso=')) ?? '';
    const a = await hop('cloud: GET /sso/authorize → 303', 'cloud', async () => { const r = await fetch(SITE + '/sso/authorize' + new URL(url).search, { redirect: 'manual', headers: { cookie: [acme, hpIntent].join('; '), 'sec-fetch-site': 'same-site' } }); return { location: r.headers.get('location'), bytes: 0 }; });
    const cb = new URL(a.location);
    const d = await hop('HP: GET /api/auth/sso/callback', 'tunnel HP', () => viaRelay(L.hp, [e.ck, bind], cb.pathname + cb.search));
    const hs = cookiesOf(d).find((c) => /^pg_session=.{8,}/.test(c)) ?? '';
    await hop('HP: GET / (the app, signed in)', 'tunnel HP', () => viaRelay(L.hp, [e.ck, hs], '/'));
    const me = await hop('HP: GET /api/bootstrap (signed in)', 'tunnel HP', () => viaRelay(L.hp, [e.ck, hs], '/api/bootstrap'));
    const total = performance.now() - t0;
    if (!JSON.parse(me.body || '{}').authenticated) throw new Error('not signed in on HP: ' + d.status + ' ' + d.body.slice(0, 200));
    if (run === 0) continue; // warm-up (next dev compiles routes on first use)
    console.log(`\nrun ${run}: ${total.toFixed(0)} ms on loopback`);
    let up = 0;
    for (const r of rows) { const wire = r.where.startsWith('tunnel') ? b64(r.bytes) : 0; up += wire; console.log(`  ${r.ms.toFixed(0).padStart(5)} ms  ${r.where.padEnd(20)} ${r.name}${r.bytes ? `  (${(r.bytes / 1024).toFixed(0)} KB${wire ? `, ${(wire / 1024).toFixed(0)} KB base64 in the tunnel` : ''})` : ''}`); }
    console.log(`  ${rows.filter((r) => !r.name.startsWith('  (')).length} requests, ${rows.filter((r) => r.where.startsWith('tunnel')).length} through a tunnel, 4 redirects (ticket 303, relay 302, authorize 303, callback page); ${(up / 1024).toFixed(0)} KB through the tunnels ≈ ${(up * 8 / (UPLINK * 1e6) * 1000).toFixed(0)} ms at ${UPLINK} Mbit/s uplink`);
  }
} catch (e) { console.log('FAIL', e); process.exitCode = 1; }
finally { cleanup(); await sleep(500); try { rmSync(work, { recursive: true, force: true }); } catch {} setTimeout(() => process.exit(process.exitCode ?? 0), 300); }
