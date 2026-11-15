// SESSIONS-1 in a phone browser (WebKit iPhone) and on a desktop width: "Sign-in & security" on the account page.
//   cd tests/e2e && npm install && PATH=~/dev/.tools/node/bin:$PATH node sessions.e2e.mjs [shot-dir]
// One quiet line "Sign-in & security · 4 active sessions" opens inline: the signed-in browsers (This device first; device,
// browser, place, masked IP, method, first/last seen), Sign out per session and Sign out all other devices with an
// inline confirm (never a dialog), and the recent activity. A signed-out browser is refused at once. Another account
// cannot list or end them. Demo data only (the place headers stand in for Cloudflare's); screenshots carry a DEMO label.
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';

const SHOTS = (process.argv[2] ?? new URL('./shots/', import.meta.url).pathname).replace(/\/?$/, '/'); mkdirSync(SHOTS, { recursive: true });
const EMAIL = 'demo@example.test';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const stack = await startStack();
const now = Date.now(), DAY = 86_400_000, MIN = 60_000;
const iso = (ms) => new Date(ms).toISOString();

const L = (id, email, o) => ({ id, email, plan: 'pro', site_id: 'default-site', connector_limit: 5, expires_at: null, status: 'active', notes: '',
  created_at: iso(now - 40 * DAY), token: 'tok-' + id + '-' + 'a'.repeat(24), ...o });
const licenses = [
  L('lic-hq', EMAIL, { plan: 'founder', connector_limit: 0, site_name: 'Head office', claimed_by: '1a'.repeat(32), claimed_hostname: 'nanopi-r3s' }),
  L('lic-mal', 'mallory@mallory.test', { site_name: 'Mal', claimed_by: '4d'.repeat(32) }),
];
for (const l of licenses) { stack.kv.set('license:' + l.id, JSON.stringify(l)); stack.kv.set('index:token:' + l.token, l.id); }
stack.kv.set('index:all', JSON.stringify(licenses.map((l) => l.id)));
stack.kv.set('sitestatus:lic-hq', JSON.stringify({ site_name: 'default-site', controller_version: '0.1.115', model: 'NanoPi R3S', received_at: now,
  devices: [{ name: 'Eaton 5PX 1500', state: 'online', version: '0.1.115', ups_status: 'OL', battery_pct: 100, load_pct: 24, runtime_sec: 3120, last_seen: Math.floor(now / 1000) }] }));
stack.kv.set('mfa:' + EMAIL, JSON.stringify({ v: 1, totp: 'demo', created_at: iso(now - 20 * DAY), last_step: 0, recovery: Array(10).fill('x'), recovery_created_at: iso(now - 20 * DAY) }));

// Sessions in the SESSIONS-1 form: record under the id's SHA-256, the account index of hashes. Cookie: the bare id.
const sha = (s) => createHash('sha256').update(s).digest('hex');
function session(email, rec) {
  const id = randomBytes(32).toString('hex'), h = sha(id), expires = now + DAY - 5 * MIN;
  stack.kv.set('session:h:' + h, JSON.stringify({ email, expires, mfa: true, ...rec }));
  const idx = JSON.parse(stack.kv.get('sessions:' + email) ?? '[]'); idx.push({ h, exp: expires });
  stack.kv.set('sessions:' + email, JSON.stringify(idx));
  return id;
}
const S = {
  phone: session(EMAIL, { created: now - 2 * 3600_000, seen: now - MIN, method: 'code', via: 'totp', ua: SAFARI_IPHONE, ip: '178.229.10.20', country: 'NL', city: 'Amsterdam' }),
  mac: session(EMAIL, { created: now - 26 * 3600_000 + 2 * 3600_000, seen: now - 3 * 3600_000, method: 'link', via: 'totp', ua: MAC_CHROME, ip: '84.241.1.2', country: 'NL', city: 'Utrecht' }),
  win: session(EMAIL, { created: now - 20 * 3600_000, seen: now - 19 * 3600_000, method: 'link', via: 'recovery', ua: WIN_EDGE, ip: '91.12.3.4', country: 'DE', city: 'Berlin' }),
  android: session(EMAIL, { created: now - 50 * MIN, seen: now - 20 * MIN, method: 'code', via: 'totp', ua: ANDROID, ip: '2a02:a46f:1234:5678::1', country: 'BE', city: '' }),
  mallory: session('mallory@mallory.test', { created: now - 30 * MIN, seen: now - MIN, method: 'link', ua: ANDROID, ip: '10.1.2.3', country: 'US' }),
};
// Earlier activity (demo), newest first, as the site writes it.
const ev = (minAgo, o) => ({ at: iso(now - minAgo * MIN), by: 'you', ...o });
stack.kv.set('activity:' + EMAIL, JSON.stringify([
  ev(1, { action: 'console.open', site: 'Head office', detail: 'portal', device: 'iPhone · Safari', place: 'Amsterdam, Netherlands', ip: '178.229.x.x' }),
  ev(50, { action: 'auth.signin', detail: 'Email code + authenticator', device: 'Android phone · Chrome', place: 'Belgium', ip: '2a02:a46f:…' }),
  ev(52, { action: 'auth.request', detail: 'code', device: 'Android phone · Chrome', place: 'Belgium', ip: '2a02:a46f:…' }),
  ev(120, { action: 'auth.signin', detail: 'Email code + authenticator', device: 'iPhone · Safari', place: 'Amsterdam, Netherlands', ip: '178.229.x.x' }),
  ev(19 * 60, { action: 'auth.mfa_failed', detail: 'at sign-in', n: 2, device: 'Windows PC · Edge', place: 'Berlin, Germany', ip: '91.12.x.x' }),
  ev(20 * 60, { action: 'auth.signin', detail: 'Email link + recovery code', device: 'Windows PC · Edge', place: 'Berlin, Germany', ip: '91.12.x.x' }),
  ev(26 * 60, { action: 'site.rename', detail: 'nanopi-r3s → Head office', device: 'Mac · Chrome', place: 'Utrecht, Netherlands', ip: '84.241.x.x' }),
  ev(3 * 24 * 60, { action: 'mfa.recovery', device: 'Mac · Chrome', place: 'Utrecht, Netherlands', ip: '84.241.x.x' }),
  ev(20 * 24 * 60, { action: 'mfa.on', detail: 'at sign-in', device: 'Mac · Chrome', place: 'Utrecht, Netherlands', ip: '84.241.x.x' }),
  ev(20 * 24 * 60 + 2, { action: 'site.claim', by: 'you', detail: 'nanopi-r3s' }),
]));
const cookie = (value) => ({ name: 'pg_session', value, domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
// Stand-ins for the headers Cloudflare adds on powerguardian.cloud.
const cf = { 'cf-connecting-ip': '178.229.10.20', 'cf-ipcountry': 'NL', 'cf-ipcity': 'Amsterdam' };

const browser = await webkit.launch();
const demo = (page) => page.evaluate(() => {
  const b = document.createElement('div');
  b.textContent = 'DEMO';
  b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:3px 9px;border-radius:6px;background:#f59e0b;color:#000;font:700 11px/1.4 system-ui;letter-spacing:.12em';
  document.body.appendChild(b);
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove());
});
// what the API says to a given cookie (any browser), and whether a cookie still works
const apiAs = async (ctx, sid, body) => {
  const headers = { cookie: 'pg_session=' + sid, ...(body ? { 'content-type': 'application/json', origin: BASE } : {}) };
  const r = body ? await ctx.request.post(BASE + '/api/account/security', { headers, data: body }) : await ctx.request.get(BASE + '/api/account/security', { headers });
  return { status: r.status(), body: await r.json().catch(() => ({})) };
};

try {
  const phone = await browser.newContext({ ...devices['iPhone 15'], userAgent: SAFARI_IPHONE, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam', extraHTTPHeaders: cf });
  await phone.addCookies([cookie(S.phone)]);
  const page = await phone.newPage();
  let dialogs = 0; page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await page.goto(BASE + '/account');
  await hydrated(page, '#security-manage');

  console.log('one quiet line on the account page');
  check('"Sign-in & security · 4 active sessions · Manage"', (await page.locator('#security').innerText()).replace(/\s+/g, ' ').trim() === 'Sign-in & security · 4 active sessions · Manage');
  check('closed by default (no list in the page)', await page.locator('#security-sessions').count() === 0);
  await page.locator('#security-manage').tap();
  await page.locator('#security-sessions .session-row').first().waitFor();

  console.log('\nthe signed-in browsers');
  const rows = page.locator('.session-row');
  check('4 rows', await rows.count() === 4);
  const first = rows.first();
  check('This device first: "iPhone · Safari" with the badge', (await first.locator('.session-device').textContent()) === 'iPhone · Safari' && await first.locator('.session-this').isVisible());
  check('only one "This device", and it has no Sign out button', await page.locator('.session-this').count() === 1 && await first.locator('.session-signout').count() === 0);
  check('this device: "Amsterdam, Netherlands · 178.229.x.x", "Active now", email code + authenticator',
    (await first.locator('.session-where').textContent()) === 'Amsterdam, Netherlands · 178.229.x.x' && /^Active now · signed in .+ · Email code \+ authenticator$/.test(await first.locator('.session-meta').textContent()));
  const row = (dev) => page.locator('.session-row', { has: page.locator('.session-device', { hasText: dev }) });
  check('Android: Belgium (no city given), IPv6 masked, "20 min ago"', (await row('Android').locator('.session-where').textContent()) === 'Belgium · 2a02:a46f:…' && (await row('Android').locator('.session-meta').textContent()).startsWith('20 min ago'));
  check('Mac · Chrome in Utrecht, last seen 3 h ago, email link + authenticator', (await row('Mac').locator('.session-where').textContent()) === 'Utrecht, Netherlands · 84.241.x.x' && /^3 h ago · .* · Email link \+ authenticator$/.test(await row('Mac').locator('.session-meta').textContent()));
  check('Windows PC · Edge, Berlin, recovery code', (await row('Windows').locator('.session-meta').textContent()).endsWith('Email link + recovery code'));
  const html = await page.content();
  check('no full IP, no session id, no hash in the page', !/178\.229\.10\.20|84\.241\.1\.2|91\.12\.3\.4|1234:5678/.test(html) && !Object.values(S).some((id) => html.includes(id) || html.includes(sha(id))));
  check('no sideways scrolling at phone width', await noSideScroll(page));
  check('buttons are at least 44 px tall on the phone', (await row('Mac').locator('.session-signout').boundingBox()).height >= 44 && (await page.locator('#security-others').boundingBox()).height >= 44);

  console.log('\nrecent activity');
  const acts = page.locator('.activity-row');
  check('8 newest lines, then "Show all 10"', await acts.count() === 8 && (await page.locator('#security-activity-all').textContent()) === 'Show all 10');
  check('"Console opened · Head office" from your account, with device and place', (await acts.first().innerText()).includes('Console opened · Head office') && (await acts.first().locator('.activity-detail').textContent()) === 'from your account' && (await acts.first().locator('.activity-where').textContent()) === 'iPhone · Safari · Amsterdam, Netherlands · 178.229.x.x');
  check('a wrong authenticator code stands out (amber) and counts repeats', /amber/.test(await page.locator('.activity-title', { hasText: 'Wrong authenticator code (2×)' }).getAttribute('class')));
  await page.locator('#security-activity-all').tap();
  check('"Show all" shows all 10', await acts.count() === 10 && (await acts.last().innerText()).includes('Licence claimed by a controller'));
  await page.locator('#security-activity-all').tap();
  await demo(page);
  await page.screenshot({ path: SHOTS + 'sessions-phone.png', fullPage: true });

  console.log('\nSign out one session (inline confirm)');
  await row('Windows').locator('.session-signout').tap();
  check('an inline confirm opens in the row, no dialog', await row('Windows').locator('.session-confirm').isVisible() && dialogs === 0);
  check('it names the device', (await row('Windows').locator('.session-confirm').innerText()).includes('Sign out this Windows PC?'));
  await row('Windows').locator('.session-confirm').scrollIntoViewIfNeeded();
  await page.screenshot({ path: SHOTS + 'sessions-confirm-phone.png' });
  await row('Windows').locator('.session-confirm-go').tap();
  await page.waitForFunction(() => document.querySelectorAll('.session-row').length === 3);
  check('the row is gone, the line says 3', await rows.count() === 3 && (await page.locator('#security-count').textContent()) === '3 active sessions');
  check('the Windows browser is refused at once', (await apiAs(phone, S.win)).status === 401);
  check('"Signed out a device · Windows PC · Edge" on top of the activity', (await acts.first().innerText()).includes('Signed out a device') && (await acts.first().innerText()).includes('Windows PC · Edge'));
  await row('Mac').locator('.session-signout').tap();
  await row('Mac').getByRole('button', { name: 'Cancel' }).tap();
  check('Cancel closes the confirm and keeps the session', await row('Mac').locator('.session-confirm').count() === 0 && await rows.count() === 3 && (await apiAs(phone, S.mac)).status === 200);

  console.log('\nanother account cannot list or end them');
  const malList = await apiAs(phone, S.mallory);
  check('mallory\'s list has only her own session', malList.status === 200 && malList.body.sessions.length === 1 && !JSON.stringify(malList.body).includes('Amsterdam'));
  const macRef = await row('Mac').getAttribute('data-ref');
  const malRevoke = await apiAs(phone, S.mallory, { action: 'revoke', ref: macRef });
  check('mallory signing out acme\'s Mac by its ref → 404, still signed in', malRevoke.status === 404 && (await apiAs(phone, S.mac)).status === 200);
  check('a signed-out cookie cannot sign out anything → 401', (await apiAs(phone, S.win, { action: 'revoke', ref: macRef })).status === 401);
  check('a forged cookie → 401', (await apiAs(phone, S.mac.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')), { action: 'revoke_others' })).status === 401);

  console.log('\nSign out all other devices');
  await page.locator('#security-others').tap();
  check('inline confirm: "This signs out 2 other devices. This one stays signed in."', (await page.locator('#security-others-confirm').innerText()).includes('This signs out 2 other devices. This one stays signed in.') && dialogs === 0);
  await page.locator('#security-others-go').tap();
  await page.waitForFunction(() => document.querySelectorAll('.session-row').length === 1);
  check('only This device is left; "1 active session"', (await page.locator('#security-count').textContent()) === '1 active session' && await page.locator('.session-this').count() === 1);
  check('the Mac and the Android phone are refused', (await apiAs(phone, S.mac)).status === 401 && (await apiAs(phone, S.android)).status === 401);
  check('this phone still works', (await apiAs(phone, S.phone)).status === 200);
  check('"Signed out all other devices · 2 devices" in the activity', (await acts.first().innerText()).includes('Signed out all other devices') && (await acts.first().innerText()).includes('2 devices'));
  check('mallory is untouched', (await apiAs(phone, S.mallory)).status === 200);
  check('still no sideways scrolling', await noSideScroll(page));
  await page.reload();
  await hydrated(page, '#security-manage');
  check('after a reload the line says "1 active session"', (await page.locator('#security-count').textContent()) === '1 active session');

  console.log('\ndesktop');
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam', userAgent: MAC_CHROME, extraHTTPHeaders: { ...cf, 'cf-ipcity': 'Utrecht', 'cf-connecting-ip': '84.241.1.2' } });
  const deskS = session(EMAIL, { created: now - 10 * MIN, seen: now - 10 * MIN, method: 'link', via: 'totp', ua: MAC_CHROME, ip: '84.241.1.2', country: 'NL', city: 'Utrecht' });
  const winAgain = session(EMAIL, { created: now - 6 * 3600_000, seen: now - 4 * 3600_000, method: 'link', via: 'totp', ua: WIN_EDGE, ip: '91.12.3.4', country: 'DE', city: 'Berlin' });
  await desk.addCookies([cookie(deskS)]);
  const dp = await desk.newPage();
  await dp.goto(BASE + '/account');
  await hydrated(dp, '#security-manage');
  check('desktop: "3 active sessions"', (await dp.locator('#security-count').textContent()) === '3 active sessions');
  await dp.locator('#security-manage').click();
  await dp.locator('.session-row').first().waitFor();
  check('desktop: This device is the Mac · Chrome', (await dp.locator('.session-row').first().locator('.session-device').textContent()) === 'Mac · Chrome' && await dp.locator('.session-row').first().locator('.session-this').isVisible());
  const sb = await dp.locator('.session-row', { hasText: 'Windows' }).locator('.session-signout').boundingBox();
  const rb = await dp.locator('.session-row', { hasText: 'Windows' }).boundingBox();
  check('desktop: Sign out sits on the right of its row', sb.x + sb.width > rb.x + rb.width - 4 && sb.width < 200);
  await demo(dp);
  await dp.screenshot({ path: SHOTS + 'sessions-desktop.png', fullPage: true });
  await dp.locator('.session-row', { hasText: 'Windows' }).locator('.session-signout').click();
  await dp.locator('.session-confirm-go').click();
  await dp.waitForFunction(() => document.querySelectorAll('.session-row').length === 2);
  check('desktop: signing out the Windows PC works and it is refused', (await apiAs(desk, winAgain)).status === 401);
  check('desktop: no sideways scrolling', await noSideScroll(dp));
  await dp.locator('#security-activity').scrollIntoViewIfNeeded();
  await dp.screenshot({ path: SHOTS + 'sessions-activity-desktop.png', fullPage: true });
} catch (e) {
  check('no exception', false, String(e?.message ?? e).split('\n')[0]);
  for (const [i, pg] of browser.contexts().flatMap((c) => c.pages()).entries()) {
    await pg.screenshot({ path: SHOTS + `fail-sessions-${i}.png`, fullPage: true }).catch(() => {});
    console.log('page', i, pg.url(), (await pg.locator('body').innerText().catch(() => '')).slice(0, 800).replace(/\n+/g, ' | '));
  }
  console.log(stack.log.text.split('\n').filter((l) => /error|warn/i.test(l)).slice(-15).join('\n'));
} finally {
  await browser.close();
  stack.stop();
}
const { passed, failed } = result();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
