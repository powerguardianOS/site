// ISO-1: tenant isolation in PG Cloud. Permanent negative suite: one customer tries to see, open, control or receive data of
// another customer's site, by every path, and is refused. Tenants: acme@test (sites Acer + HP), beurs@test (site Beurs),
// mallory@test (site Mal, the attacker). Every check names the attack.
// Run: npx tsx tests/isolation.test.mts        (the full chain: node scripts/isolation-e2e.mjs)
import { kv, put, get, seed, lic, check, done } from './harness.mts';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createSession, getSession, getSessionInfo } from '../app/lib/session.ts';

process.env.RELAY_MINT_SECRET = 'mint-secret';
const mints: string[] = [];
const kvFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  if (String(url).startsWith('https://relay.powerguardian.cloud/mint/')) { mints.push(String(url).split('/').pop()!); return Response.json({ token: 'sub', jti: 'j', expires_at: 1 }); }
  return kvFetch(url, init);
};

const { POST: heartbeat } = await import('../app/api/cloud/heartbeat/route.ts');
const { PATCH: cloudRename } = await import('../app/api/cloud/site/route.ts');
const { GET: cloudSites } = await import('../app/api/cloud/sites/route.ts');
const { POST: cloudConsole } = await import('../app/api/cloud/sites/console/route.ts');
const { PATCH: portalRename } = await import('../app/api/account/sites/[id]/route.ts');
const { POST: portalAction } = await import('../app/api/account/sites/[id]/actions/route.ts');
const { POST: claim } = await import('../app/api/license/claim/route.ts');
const { POST: licVerify } = await import('../app/api/license/verify/route.ts');
const { POST: relayValidate } = await import('../app/api/relay/validate/route.ts');
const { GET: ssoGet, POST: ssoPost } = await import('../app/sso/authorize/route.ts');
const { createTicket, decideHeartbeat } = await import('../app/lib/sitelink.ts');
const { siteLabel } = await import('../app/lib/relay-mint.ts');

const C_ACER = 'a'.repeat(64), C_HP = 'b'.repeat(64), C_BEURS = 'c'.repeat(64), C_MAL = 'd'.repeat(64);
const acer = lic('lic-acer', 'acme@test', { site_name: 'Acer', claimed_by: C_ACER });
const hp = lic('lic-hp', 'acme@test', { site_name: 'HP', claimed_by: C_HP });
const beurs = lic('lic-beurs', 'beurs@test', { site_name: 'Beurs', claimed_by: C_BEURS });
const mal = lic('lic-mal', 'mallory@test', { site_name: 'Mal', claimed_by: C_MAL });
seed(acer, hp, beurs, mal);
const now = Date.now();
const st = (name: string) => ({ site_name: name, controller_version: '0.1.116', devices: [], received_at: now - 60_000, model: name + ' box', lan: ['192.168.1.' + name.length] });
for (const [id, n] of [['lic-acer', 'Acer'], ['lic-hp', 'HP'], ['lic-beurs', 'Beurs'], ['lic-mal', 'Mal']]) put('sitestatus:' + id, st(n));

const json = async (r: Response) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }) as any;
const ORIGIN = 'https://powerguardian.cloud';
const malCookie = await createSession('mallory@test');
const malSid = malCookie; // ownerGuard keys the re-confirmation by the cookie value
put('reconfirm:ok:' + malSid, '1'); // mallory even passed the e-mail re-confirmation for her own account
const own = (method: string, path: string, body: unknown, cookie = malCookie) =>
  new Request(ORIGIN + path, { method, headers: { cookie: 'pg_session=' + cookie, 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) });
const ctl = (path: string, token: string, cid: string, body?: unknown, method = 'POST') =>
  new Request('http://x' + path, { method, headers: { authorization: 'Bearer ' + token, 'x-controller-id': cid, 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const untouched = (id: string, l: any) => { const now = get('license:' + id); return JSON.stringify({ ...now, copies: undefined }) === JSON.stringify({ ...l, copies: undefined }); };

console.log('portal (signed in as mallory@test)');
for (const id of ['lic-acer', 'lic-hp', 'lic-beurs']) {
  const r = await json(await portalRename(own('PATCH', `/api/account/sites/${id}`, { name: 'pwned' }), { params: Promise.resolve({ id }) }));
  check(`mallory renames ${id} → 404, name unchanged`, r.status === 404 && get('license:' + id).site_name !== 'pwned', JSON.stringify(r));
}
for (const action of ['release', 'replace', 'keep', 'remove', 'offline_lease']) {
  const r = await json(await portalAction(own('POST', '/api/account/sites/lic-acer/actions', { action, controller_id: C_MAL }), { params: Promise.resolve({ id: 'lic-acer' }) }));
  check(`mallory "${action}" on acme's Acer → 404, licence untouched`, r.status === 404 && untouched('lic-acer', acer), JSON.stringify(r));
}
{
  const forged = malCookie.replace(/^(s2\.[0-9a-f]+\.\d+\.)[^.]+/, (_, h) => h + Buffer.from('acme@test').toString('base64url'));
  check('mallory edits the e-mail inside her session cookie to acme@test → no session', (await getSession(forged)) === null);
  const mfa = malCookie.replace(/\.-\.([^.]+)$/, '.m.$1');
  check('mallory flips the two-step flag in her cookie → no session', (await getSessionInfo(mfa)) === null);
  const r = await json(await portalRename(own('PATCH', '/api/account/sites/lic-acer', { name: 'x' }, forged), { params: Promise.resolve({ id: 'lic-acer' }) }));
  check('a forged cookie on a manage action → 401', r.status === 401);
}

console.log('\ncontroller APIs (mallory owns her controller and its licence token)');
{
  kv.delete('sitestatus:lic-mal');
  const r = await json(await heartbeat(ctl('/api/cloud/heartbeat', mal.token, C_MAL, { controller_id: C_ACER, site_name: 'Acer', hostname: 'acer' })));
  check('mallory heartbeats with acme\'s hardware ID: never lands in acme\'s site', untouched('lic-acer', acer) && get('sitestatus:lic-acer').site_name === 'Acer', JSON.stringify(r));
  check('…and gets no lease for acme\'s licence', !JSON.stringify(r).includes('lic-acer'));
  check('heartbeat with acme\'s licence id instead of a token → 401', (await heartbeat(ctl('/api/cloud/heartbeat', 'lic-acer', C_MAL, {}))).status === 401);
  check('heartbeat with a guessed token → 401', (await heartbeat(ctl('/api/cloud/heartbeat', 'tok-lic-acer-' + 'b'.repeat(20), C_MAL, {}))).status === 401);
}
{
  const r = await json(await cloudRename(ctl('/api/cloud/site', mal.token, C_MAL, { name: 'pwned', controller_id: C_MAL, license_id: 'lic-acer', site_id: 'lic-acer' }, 'PATCH')));
  check('mallory renames "lic-acer" from her controller: only her own site changes', get('license:lic-acer').site_name === 'Acer' && get('license:lic-mal').site_name === 'pwned', JSON.stringify(r));
  put('license:lic-mal', mal);
}
{
  const r = await json(await cloudSites(ctl('/api/cloud/sites', mal.token, C_MAL, undefined, 'GET')));
  const s = JSON.stringify(r);
  check('mallory\'s site list has her site only', r.status === 200 && r.sites.length === 1 && r.sites[0].id === 'lic-mal', s);
  check('…never a name, model or address of another tenant', !/Acer|HP|Beurs|192\.168\.1\.4|192\.168\.1\.5/.test(s), s);
  check('mallory\'s token with acme\'s hardware ID (a "copy") → 403, no list', (await cloudSites(ctl('/api/cloud/sites', mal.token, C_ACER, undefined, 'GET'))).status === 403);
}
for (const id of ['lic-acer', 'lic-hp', 'lic-beurs']) {
  const before = mints.length;
  const r = await json(await cloudConsole(ctl('/api/cloud/sites/console', mal.token, C_MAL, { site_id: id })));
  check(`mallory asks a console link for ${id} → 404, nothing minted`, r.status === 404 && mints.length === before, JSON.stringify(r));
}

console.log('\nlicence claim / move');
{
  const t = await createTicket('mallory@test', C_MAL, 'mal');
  for (const id of ['lic-acer', 'lic-beurs']) {
    const r = await json(await claim(new Request('http://x/api/license/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket: t, license_id: id, transfer: true, acknowledge: true }) }) as any));
    check(`mallory claims ${id} with her own ticket (transfer + acknowledge) → 404, licence untouched, no token`, r.status === 404 && !r.token && untouched(id, id === 'lic-acer' ? acer : beurs), JSON.stringify(r));
  }
  const r = await json(await claim(new Request('http://x/api/license/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket: 'f'.repeat(48), license_id: 'lic-acer' }) }) as any));
  check('a guessed claim ticket → 401', r.status === 401 && !r.token);
}
{
  const r = await json(await licVerify(new Request('http://x', { method: 'POST', body: JSON.stringify({ license_key: 'lic-acer' }) }) as any));
  check('licence verify with acme\'s licence id (not its token) → not valid', r.valid === false);
  const v = await json(await relayValidate(new Request('http://x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: acer.token }) }) as any));
  check('relay validate without the relay secret (token → licence oracle) → 401', v.status === 401 && !v.license_id);
}
{
  // a controller that held a site before it moved keeps a retired entry; it never acts as the new holder, nor as another site
  const moved = { ...acer, token: 'tok-new-' + 'e'.repeat(24), retired: [{ controller_id: C_MAL, token: acer.token, until: new Date(now - 1000).toISOString(), reason: 'moved', at: new Date(now - 86400_000).toISOString() }] };
  const d = decideHeartbeat(moved as any, acer.token, C_MAL, Math.floor(now / 1000));
  check('a retired controller replaying the old token after its lease → denied', d.kind === 'denied');
  const d2 = decideHeartbeat(moved as any, acer.token, C_ACER, Math.floor(now / 1000));
  check('the old token with the holder\'s hardware ID (spoofed) → denied', d2.kind === 'denied');
}

console.log('\nCLOUD-SSO (mallory signed in)');
const NONCE = '1'.repeat(32);
const ssoQ = (o: Record<string, string>) => new URLSearchParams({ controller: C_ACER, nonce: NONCE, return: 'https://192.168.1.10/api/auth/sso/callback', ...o });
const sGet = (o: Record<string, string>) => ssoGet(new Request(ORIGIN + '/sso/authorize?' + ssoQ(o), { headers: { cookie: 'pg_session=' + malCookie } }));
const sPost = (o: Record<string, string>) => ssoPost(new Request(ORIGIN + '/sso/authorize', { method: 'POST', headers: { cookie: 'pg_session=' + malCookie, origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: ssoQ(o).toString() }));
for (const c of [C_ACER, C_HP, C_BEURS]) {
  const g = await sGet({ controller: c }), p = await sPost({ controller: c });
  check(`mallory asks a sign-in statement for controller ${c.slice(0, 4)}… of another tenant → 403, none issued`, g.status === 403 && p.status === 403 && !p.headers.get('location'));
}
{
  // mallory registers acme's hardware ID on her own licence (the controller reports its id itself): the statement she gets
  // names HER site, which acme's controller refuses (controller/isolation_test.go TestIsoSSOStatementForAnotherTenantsSiteIsRefused)
  put('license:lic-mal', { ...mal, claimed_by: C_ACER });
  const p = await sPost({ controller: C_ACER });
  const tok = decodeURIComponent((p.headers.get('location') ?? '').split('assertion=')[1] ?? '');
  const body = tok ? JSON.parse(Buffer.from(tok.slice('pgsso1.'.length, tok.lastIndexOf('.')), 'base64url').toString()) : null;
  check('a statement for "acme\'s hardware ID" via mallory\'s licence names mallory\'s site, never acme\'s', !body || (body.site_id === 'lic-mal' && body.email === 'mallory@test'), JSON.stringify(body));
  const acmeHost = `https://${await siteLabel('lic-acer')}-console.powerguardian.cloud/api/auth/sso/callback`;
  const ph = await sPost({ controller: C_ACER, return: acmeHost });
  check('…and it can never be delivered to acme\'s console origin', ph.status === 400 && !ph.headers.get('location'));
  for (const shared of ['https://console.powerguardian.cloud/api/auth/sso/callback', 'https://relay.powerguardian.cloud/api/auth/sso/callback']) {
    const r = await sPost({ controller: C_ACER, return: shared });
    check(`…nor to a shared relay origin (${new URL(shared).host})`, r.status === 400 && !r.headers.get('location'));
  }
  const malHost = `https://${await siteLabel('lic-mal')}-console.powerguardian.cloud/api/auth/sso/callback`;
  check('her own site\'s console origin works (control)', (await sPost({ controller: C_ACER, return: malHost })).status === 303);
  put('license:lic-mal', mal);
}

console.log('\nadmin endpoints: every handler checks the admin itself (route handlers are not covered by the admin layout)');
{
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => statSync(d + '/' + f).isDirectory() ? walk(d + '/' + f) : [d + '/' + f]);
  const root = new URL('../app/api/admin', import.meta.url).pathname;
  for (const f of walk(root).filter((f) => f.endsWith('route.ts'))) {
    const src = readFileSync(f, 'utf8');
    const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\)\s*\{\s*([^\n]*\n[^\n]*)/g)];
    const ok = handlers.length > 0 && handlers.every((m) => /adminGuard\(request\)|getAdminEmail\(\)/.test(m[2]));
    check(`${f.slice(root.length)}: every handler starts with the admin check`, ok, handlers.map((m) => m[1]).join(','));
  }
  const admin = readFileSync(new URL('../app/lib/admin.ts', import.meta.url), 'utf8');
  check('admin = exactly ADMIN_EMAIL (case-insensitive), refused when ADMIN_EMAIL is unset', /!adminEmail \|\| email\.toLowerCase\(\) !== adminEmail\.toLowerCase\(\)/.test(admin));
}

console.log('\nids are not guessable');
check('licence ids are random UUIDs (createLicense)', /id: crypto\.randomUUID\(\)/.test(readFileSync(new URL('../app/lib/license-db.ts', import.meta.url), 'utf8')));
check('licence tokens are 128-bit random', /token: randomHex\(16\)/.test(readFileSync(new URL('../app/lib/license-db.ts', import.meta.url), 'utf8')));
check('the console host label does not reveal the licence id', !(await siteLabel('lic-acer')).includes('acer') && /^[0-9a-f]{16}$/.test(await siteLabel('lic-acer')));

done();
