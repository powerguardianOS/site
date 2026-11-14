// CLOUD-1 steps B+C: a REAL controller (built from the ctl worktree) + the local site + the relay under `wrangler dev`.
// 127.0.0.1 only. Nothing live. Test-only tweak: the relay copy re-validates every 5 s instead of 10 min (the repo file is not changed).
// Usage: PATH=~/dev/.tools/node/bin:~/dev/.tools/go/bin:$PATH node scripts/cloud-chain-real.mjs
//   env CTL_DIR (default ~/.pg-work/ctl-relayurl), RELAY_DIR (default ~/.pg-work/relay-cloud)
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { startDev, SITE, ORIGIN, ADMIN, MINT, H, RELAY_PORT } from './cloud-dev.mjs';

const CTL_DIR = process.env.CTL_DIR ?? path.join(homedir(), '.pg-work/ctl-relayurl');
const RELAY_DIR = process.env.RELAY_DIR ?? path.join(homedir(), '.pg-work/relay-cloud');
const CTL_PORT = 19090, CUSTOMER = 'customer@example.test';
const work = mkdtempSync(path.join(tmpdir(), 'pg-chain-real-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, step = 500) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(step); } return null; };
let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  -> ' + extra : ''}`); cond ? pass++ : fail++; return cond; };
const procs = [];
let dev, relayLog = '';
const cleanup = () => { for (const p of procs) p.kill('SIGTERM'); dev?.stop(); };

try {
  dev = await startDev();
  const j = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
  const sitePost = (p, body, headers = {}) => fetch(SITE + p, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) }).then(j);
  const mailTo = async (to, n = 1) => (await until(() => { const m = dev.mails.filter((x) => x.to === to); return m.length >= n ? m.at(-1) : null; }, 8000, 100));
  const signIn = async (email) => {
    const before = dev.mails.filter((x) => x.to === email).length;
    await sitePost('/api/auth/magic', { email });
    const m = await mailTo(email, before + 1);
    const link = m?.text.match(/https?:\/\/\S+\/api\/auth\/verify\?token=\w+/)?.[0];
    // LOGIN-1: the link (GET) shows a confirm page; the button POSTs the token.
    const v = await fetch(SITE + '/api/auth/verify', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN }, body: new URLSearchParams({ token: new URL(link).searchParams.get('token') }).toString() });
    return (v.headers.get('set-cookie') ?? '').match(/pg_session=[^;]+/)?.[0];
  };

  console.log('prep: relay (wrangler dev, REVALIDATE_MS=5000 in a temp copy) and controller binary');
  const rdir = path.join(work, 'relay'); cpSync(RELAY_DIR + '/src', rdir + '/src', { recursive: true }); cpSync(RELAY_DIR + '/wrangler.toml', rdir + '/wrangler.toml');
  symlinkSync(RELAY_DIR + '/node_modules', rdir + '/node_modules');
  // test only: the per-IP rate limit (6/min) would throttle this script's own polling
  writeFileSync(rdir + '/wrangler.toml', readFileSync(rdir + '/wrangler.toml', 'utf8').replace('limit = 6', 'limit = 6000'));
  const doFile = rdir + '/src/relay-do.js';
  writeFileSync(doFile, readFileSync(doFile, 'utf8').replace('const REVALIDATE_MS = 10 * 60 * 1000;', 'const REVALIDATE_MS = 5 * 1000;'));
  const relay = spawn(RELAY_DIR + '/node_modules/.bin/wrangler', ['dev', '--ip', H, '--port', String(RELAY_PORT), '--var', `CLOUD_BASE:${SITE}`, '--var', `MINT_SECRET:${MINT}`], { cwd: rdir, env: { ...process.env, CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  relay.stdout.on('data', (d) => (relayLog += d)); relay.stderr.on('data', (d) => (relayLog += d)); procs.push(relay);
  const bin = path.join(work, 'pg-controller');
  execFileSync('go', ['build', '-tags', 'pge2e', '-o', bin, '.'], { cwd: CTL_DIR + '/controller', stdio: 'inherit' });
  const relayUp = await until(async () => { try { return (await fetch(`http://${H}:${RELAY_PORT}/status/x`, { headers: { Authorization: 'Bearer ' + 'a'.repeat(32) } })).status; } catch { return 0; } }, 120000, 2000);
  ok('relay answers; unknown token rejected (401)', relayUp === 401, String(relayUp));

  console.log('A. site: admin creates the licence');
  const adminCookie = await signIn(ADMIN);
  const created = await sitePost('/api/admin/licenses', { email: CUSTOMER, plan: 'pro', connector_limit: 5, expires_at: new Date(Date.now() + 365 * 864e5).toISOString(), site_name: 'Real chain site' }, { cookie: adminCookie });
  ok('licence created', created.status === 201, created.error);
  const licId = created.license?.id;

  console.log('B1. real controller starts (own temp data dir, 127.0.0.1 only)');
  let ctlLog = '';
  const ctl = spawn(bin, ['-addr', `${H}:${CTL_PORT}`, '-db', path.join(work, 'pg.db')], { cwd: work,
    env: { ...process.env, PG_CLOUD_URL: SITE, PG_RELAY_URL: `ws://${H}:${RELAY_PORT}`, PG_LEASE_PUBKEY: dev.rawPub, PG_E2E_NO_DISCOVERY: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  ctl.stdout.on('data', (d) => (ctlLog += d)); ctl.stderr.on('data', (d) => (ctlLog += d)); procs.push(ctl);
  const C = `http://${H}:${CTL_PORT}`;
  ok('controller is up', !!(await until(async () => { try { return (await fetch(C + '/api/auth/me')).status > 0; } catch { return false; } }, 30000)), ctlLog.slice(-300));
  const cpost = (p, body, cookie) => fetch(C + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  const su = await cpost('/api/setup/admin', { username: 'owner', email: 'owner@example.test', password: 'Correct-horse-1', password2: 'Correct-horse-1' });
  ok('owner created', su.status === 200, String(su.status));
  const lg = await cpost('/api/auth/login', { username: 'owner', password: 'Correct-horse-1' });
  const ck = (lg.headers.get('set-cookie') ?? '').split(';')[0];
  ok('owner logged in', lg.status === 200 && !!ck, String(lg.status));

  console.log('B2. claim through the controller API, code from the fake mailbox');
  const le = await j(await cpost('/api/license/link-email', { email: CUSTOMER }, ck));
  ok('link-email: code sent', le.sent === true, JSON.stringify(le));
  const code = (await mailTo(CUSTOMER))?.text.match(/code is: (\d{6})/)?.[1];
  ok('code in the fake mailbox', !!code);
  const ce = await j(await cpost('/api/license/confirm-email', { code }, ck));
  ok('confirm-email: choose a site, free site offered', ce.status === 'choose' && ce.sites?.[0]?.license_id === licId, JSON.stringify(ce).slice(0, 150));
  const cl = await j(await cpost('/api/license/claim', { license_id: licId, site_name: 'Real chain site' }, ck));
  ok('claim: linked, plan pro', cl.status === 'linked' && cl.plan === 'pro', JSON.stringify(cl));
  const st = await j(await fetch(C + '/api/license/status', { headers: { cookie: ck, 'x-requested-with': 'XMLHttpRequest' } }));
  ok('controller license status valid after claim (lease accepted, signature checked against PG_LEASE_PUBKEY)', JSON.stringify(st).includes('pro'), JSON.stringify(st).slice(0, 200));
  ok('no lease refusal in the controller log', !/lease refused|lease from claim refused/.test(ctlLog));

  // the licence token (what the relay validates): read it from KV, same place the site keeps it
  const token = JSON.parse([...dev.kv.entries()].find(([k]) => k.startsWith('license:') && k.includes(licId))?.[1] ?? '{}').token
    ?? (() => { for (const v of dev.kv.values()) { try { const o = JSON.parse(v); if (o.id === licId && o.token) return o.token; } catch {} } })();
  ok('licence token found in KV', !!token);

  console.log('B3. heartbeat 200 (real controller, every 60 s, first after 10 s)');
  const hb = await until(() => /POST \/api\/cloud\/heartbeat 200/.test(dev.log.text), 90000, 1000);
  ok('site log shows POST /api/cloud/heartbeat 200', !!hb);
  ok('controller log has no heartbeat failure', !/cloud heartbeat:/.test(ctlLog), (ctlLog.match(/cloud heartbeat:.*/) ?? [''])[0]);

  console.log('C1/2. relay tunnel (controller sends Authorization: Bearer; token is not in any URL)');
  const statusOf = async () => (await fetch(`http://${H}:${RELAY_PORT}/status/x`, { headers: { Authorization: 'Bearer ' + token } }).then(j));
  const conn = await until(async () => (await statusOf()).connected === true, 30000, 1000);
  ok('relay status says controller connected', !!conn, JSON.stringify(await statusOf()));
  ok('controller log: "cloud relay: connected"', /cloud relay: connected/.test(ctlLog));
  ok('relay log never shows the token', !relayLog.includes(token));
  await sleep(8000); // more than one 5 s re-validation round
  ok('tunnel still open after re-validation rounds', (await statusOf()).connected === true);

  console.log('C3. newest connection wins (legacy path-token form, as older controllers connect)');
  const ws = new WebSocket(`ws://${H}:${RELAY_PORT}/connect/${token}?type=controller`);
  let wsClose = null; const opened = await new Promise((res) => { ws.onopen = () => res(true); ws.onerror = () => res(false); setTimeout(() => res(false), 10000); });
  ws.onclose = (e) => (wsClose = e.code);
  ok('legacy path-token connection accepted', opened);
  ok('controller was replaced with close code 4000', !!(await until(() => /disconnected \(.*4000/.test(ctlLog), 15000, 500)), (ctlLog.match(/cloud relay: disconnected.*/) ?? [''])[0]);
  ok('then the controller reconnects and replaces the probe: probe closed with 4000', !!(await until(() => wsClose === 4000, 30000, 500)), String(wsClose));
  ok('relay shows the controller connected again', !!(await until(async () => (await statusOf()).connected === true, 20000, 500)));

  console.log('C4. browser: relay-session + /console/');
  const custCookie = await signIn(CUSTOMER);
  const rs = await fetch(SITE + '/api/account/relay-session', { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: custCookie }, body: JSON.stringify({ license_id: licId }) }).then(j);
  ok('relay-session returns a console_url on the local relay', rs.status === 200 && rs.console_url?.startsWith(`http://${H}:${RELAY_PORT}/console/`), JSON.stringify(rs).slice(0, 120));
  if (rs.console_url) {
    const page = await fetch(rs.console_url, { redirect: 'follow' });
    const html = await page.text();
    ok('/console/ serves the controller UI through the tunnel (200, html)', page.status === 200 && /<html|<!doctype/i.test(html), `${page.status} ${html.length} bytes`);
    const sub = rs.console_url.split('/console/')[1].replace(/\/$/, '');
    const api = await fetch(`http://${H}:${RELAY_PORT}/proxy/${sub}/api/auth/me`);
    ok('/proxy/ reaches the controller API (answers 401: not logged in)', api.status === 401, String(api.status));
  }

  console.log('C5. revoke -> heartbeat 403 and tunnel closes with 4001');
  const rev = await fetch(`${SITE}/api/admin/licenses/${licId}`, { method: 'PATCH', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: adminCookie }, body: JSON.stringify({ status: 'revoked' }) }).then(j);
  ok('admin revokes', rev.status === 200, rev.error);
  ok('relay closes the tunnel with 4001 (controller log)', !!(await until(() => /disconnected \(.*4001/.test(ctlLog), 40000, 500)), (ctlLog.match(/cloud relay: disconnected.*4001.*/) ?? [''])[0]);
  ok('relay no longer lists the controller as connected', (await statusOf()).connected !== true || (await statusOf()).error !== undefined);
  const h403 = await until(() => /POST \/api\/cloud\/heartbeat 403/.test(dev.log.text), 90000, 1000);
  ok('site log shows POST /api/cloud/heartbeat 403 (next controller heartbeat)', !!h403);
  ok('controller locked the licence with the revoked reason', !!(await until(() => /license ended \(revoked\)/.test(ctlLog), 5000, 500)), (ctlLog.match(/cloud heartbeat: license ended.*/) ?? [''])[0]);
} catch (e) { console.log(' FAIL  script error', e); fail++; }
finally {
  cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('--- tmp dir', work); console.log('--- relay log tail ---\n' + relayLog.slice(-1500)); }
  setTimeout(() => process.exit(fail ? 1 : 0), 500);
}
