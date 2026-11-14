// The installable "PowerGuardian" home-screen app on an iPhone (WebKit, standalone emulated: navigator.standalone and
// display-mode: standalone). One app with all sites (My sites). Inside the app a mail link would open in Safari, so the
// sign-in page offers the 6-digit code first; then two-step sign-in, then My sites; a site tile opens the console in the
// same window (never a new tab: that would leave the app). Demo data only; screenshots carry a DEMO label.
//   cd tests/e2e && npm install && PATH=~/dev/.tools/node/bin:$PATH node pwa.e2e.mjs [shot-dir]
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';
import { totp } from '../../scripts/cloud-dev.mjs';

const SHOTS = (process.argv[2] ?? new URL('./shots/', import.meta.url).pathname).replace(/\/?$/, '/'); mkdirSync(SHOTS, { recursive: true });
const EMAIL = 'app@example.test';
const stack = await startStack();
const now = Date.now(), DAY = 86_400_000, SLOT = 30 * 60_000, at = Math.floor(now / SLOT);
const iso = (ms) => new Date(ms).toISOString();
const L = (id, o) => ({ id, email: EMAIL, plan: 'pro', site_id: 'default-site', connector_limit: 5, expires_at: null, status: 'active', notes: '',
  created_at: iso(now - 40 * DAY), token: 'tok-' + id + '-' + 'a'.repeat(24), ...o });
const licenses = [
  L('lic-acer', { plan: 'founder', connector_limit: 0, site_name: 'Acer', claimed_by: '1a'.repeat(32), claimed_hostname: 'acer-veriton' }),
  L('lic-hp', { plan: 'founder', connector_limit: 0, site_name: 'HP', minted_from: 'lic-acer', claimed_by: '2b'.repeat(32), claimed_hostname: 'hp-prodesk-400' }),
];
for (const l of licenses) { stack.kv.set('license:' + l.id, JSON.stringify(l)); stack.kv.set('index:token:' + l.token, l.id); }
stack.kv.set('index:all', JSON.stringify(licenses.map((l) => l.id)));
const dev = (name, ups_status, battery_pct, load_pct, runtime_sec) => ({ name, state: 'online', version: '0.1.117', ups_status, battery_pct, load_pct, runtime_sec, last_seen: Math.floor(now / 1000) });
const status = (o) => JSON.stringify({ site_name: 'default-site', controller_version: '0.1.117', devices: [], received_at: Date.now(), ...o });
stack.kv.set('sitestatus:lic-acer', status({ model: 'Acer Veriton', power: { at, s: 'm'.repeat(48), m: '0'.repeat(48) }, devices: [dev('Eaton 5PX 1500', 'OL', 100, 24, 3120), dev('APC Smart-UPS 1000', 'OL CHRG', 96, 31, 2280)] }));
stack.kv.set('sitestatus:lic-hp', status({ model: 'HP ProDesk 400 G3 DM', power: { at, s: 'm'.repeat(40) + 'b' + 'm'.repeat(7), m: '0'.repeat(48) }, devices: [dev('CyberPower OR600', 'OL', 100, 12, 5400)] }));

const STANDALONE = () => {
  Object.defineProperty(navigator, 'standalone', { get: () => true });
  const mm = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm(q));
  window.__opened = [];
  window.open = (...a) => { window.__opened.push(String(a[0])); return null; };
};
const demo = (page) => page.evaluate(() => {
  const b = document.createElement('div');
  b.textContent = 'DEMO';
  b.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top) + 10px);right:10px;z-index:9999;padding:3px 9px;border-radius:6px;background:#f59e0b;color:#000;font:700 11px/1.4 system-ui;letter-spacing:.12em';
  document.body.appendChild(b);
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove());
});

const browser = await webkit.launch();
try {
  console.log('installable');
  const ctx = await browser.newContext({ ...devices['iPhone 15'], userAgent: IPHONE_UA, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam' });
  const req = ctx.request;
  const mf = await (await req.get(BASE + '/manifest.webmanifest')).json().catch(() => ({}));
  check('manifest: name PowerGuardian, start /account, scope /, standalone, site colours', mf.name === 'PowerGuardian' && mf.start_url === '/account' && mf.scope === '/' && mf.display === 'standalone' && mf.background_color === '#060a14' && mf.theme_color === '#060a14', JSON.stringify(mf));
  check('manifest: 192/512 icons and a maskable one', (mf.icons ?? []).some((i) => i.sizes === '192x192') && (mf.icons ?? []).some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of mf.icons ?? []) check(`icon ${i.src} is served as PNG`, (await req.get(BASE + i.src)).headers()['content-type'] === 'image/png');
  const page = await ctx.newPage();
  await ctx.addInitScript(STANDALONE);
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const head = await page.evaluate(() => ({
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? '',
    capable: document.querySelector('meta[name="mobile-web-app-capable"],meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content') ?? '',
    title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content') ?? '',
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '',
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
  }));
  check('home-screen meta: apple-touch-icon, web-app capable, title PowerGuardian, manifest link', head.apple.includes('apple-touch-icon') && head.capable === 'yes' && head.title === 'PowerGuardian' && head.manifest.includes('manifest'), JSON.stringify(head));
  check('viewport-fit=cover, and zooming is not switched off', /viewport-fit=cover/.test(head.viewport) && !/user-scalable=no|maximum-scale=1/.test(head.viewport), head.viewport);
  check('(test) the page sees itself as the installed app', await page.evaluate(() => navigator.standalone === true && matchMedia('(display-mode: standalone)').matches));

  console.log('\nsigning in inside the app: the 6-digit code first');
  await hydrated(page);
  await page.waitForFunction(() => /6-digit code/.test(document.querySelector('button[type=submit]')?.textContent ?? '') && /link instead/.test(document.querySelector('#signin-mode')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
  check('the code is the default in the app', ((await page.locator('button[type=submit]').textContent()) ?? '').includes('6-digit code'));
  check('the link stays one tap away', ((await page.locator('#signin-mode').textContent()) ?? '').includes('link instead'));
  const fs = await page.locator('input[type=email]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check('the e-mail field uses 16 px text (iOS does not zoom in)', fs >= 16, String(fs));
  await page.locator('input[type=email]').fill(EMAIL);
  const before = stack.mails.filter((m) => m.to === EMAIL).length;
  await page.locator('button[type=submit]').tap();
  await page.locator('#signin-code').waitFor();
  let code = '';
  for (let i = 0; i < 50 && !code; i++) { const m = stack.mails.filter((x) => x.to === EMAIL); if (m.length > before) code = m.at(-1).text.match(/\b(\d{6})\b/)?.[1] ?? ''; else await page.waitForTimeout(100); }
  check('the mail carries the code', /^\d{6}$/.test(code));
  const cfs = await page.locator('#signin-code').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check('the code field: numeric keyboard, one-time-code autofill, 16 px', (await page.locator('#signin-code').getAttribute('inputmode')) === 'numeric' && (await page.locator('#signin-code').getAttribute('autocomplete')) === 'one-time-code' && cfs >= 16);
  await demo(page); await page.screenshot({ path: SHOTS + 'pwa-code.png' });
  await page.locator('#signin-code').fill(code === '000000' ? '111111' : '000000');
  await page.locator('#signin-code-submit').tap();
  await page.locator('#signin-code-error').waitFor();
  check('a wrong code says so, tries left', /not right — 4 tries left/.test(await page.locator('#signin-code-error').textContent()));
  await page.locator('#signin-code').fill(code);
  await page.locator('#signin-code-submit').tap();
  await page.waitForURL(/\/login\/mfa/);
  check('the right code → the two-step setup (this account manages sites), still in the app', new URL(page.url()).pathname === '/login/mfa');
  const key = (await page.locator('#mfa-key').textContent()).replace(/\s/g, '');
  await page.locator('#mfa-code').fill(totp(key));
  await page.locator('#mfa-submit').tap();
  await page.locator('#mfa-continue').waitFor();
  await page.locator('#mfa-continue').tap();
  await page.waitForURL(/\/account$/);
  check('then My sites', true);

  console.log('\nMy sites in the app');
  await page.locator('article.site-card').first().waitFor();
  const names = await page.locator('article.site-card .site-name').allTextContents();
  check('both sites in one app', names.some((n) => n.includes('Acer')) && names.some((n) => n.includes('HP')), names.join(','));
  check('no sideways scrolling', await noSideScroll(page));
  const pad = await page.evaluate(() => getComputedStyle(document.body).paddingTop);
  const css = await page.evaluate(() => [...document.styleSheets].some((sh) => { try { return [...sh.cssRules].some((r) => r.conditionText?.includes('display-mode: standalone') && r.cssText.includes('safe-area-inset-top')); } catch { return false; } }));
  check('safe-area padding rule for the installed app is on the page', css, pad);
  await demo(page); await page.screenshot({ path: SHOTS + 'pwa-my-sites.png' });

  console.log('\nopening a site from the app');
  let landed = '';
  await page.route('**/api/account/relay-session', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ console_url: BASE + '/demo-console/acer' }) }));
  await page.route('**/demo-console/**', (r) => { landed = r.request().url(); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Acer</title><h1>Acer console</h1>' }); });
  await page.locator('article.site-card', { has: page.locator('.site-name', { hasText: 'Acer' }) }).locator('button.open-console').dispatchEvent('click'); // the tile's own button (the strip above it takes taps)
  await page.waitForURL(/demo-console/).catch(() => {});
  check('a site tile opens the console in the same window', landed.endsWith('/demo-console/acer') && page.url().endsWith('/demo-console/acer'), page.url());
  check('…never a new tab (that would leave the app for Safari)', await page.evaluate(() => (window.__opened ?? []).length === 0));
  await ctx.close();

  console.log('\nin a normal browser (not installed)');
  const ctx2 = await browser.newContext({ ...devices['iPhone 15'], userAgent: IPHONE_UA, ignoreHTTPSErrors: true });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/login'); await hydrated(p2);
  check('the link stays the default in a browser', ((await p2.locator('button[type=submit]').textContent()) ?? '').includes('sign-in link'));
  await p2.goto(BASE + '/login?next=console'); await hydrated(p2);
  check('…but a controller site switch (next=console) offers the code first', ((await p2.locator('button[type=submit]').textContent()) ?? '').includes('6-digit code'));
  await p2.goto(BASE + '/login?next=sso'); await hydrated(p2);
  check('…and so does a controller sign-in (next=sso)', ((await p2.locator('button[type=submit]').textContent()) ?? '').includes('6-digit code'));
  await ctx2.close();
} catch (e) { check('script error: ' + (e?.message ?? e), false); }
finally {
  await browser.close();
  stack.stop();
  const { passed, failed } = result();
  console.log(`\n${passed} passed, ${failed} failed`);
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}
