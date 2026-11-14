// ACCOUNT-UI in a phone browser (WebKit iPhone) and on a desktop width.
//   cd tests/e2e && npm install && PATH=~/dev/.tools/node/bin:$PATH node account.e2e.mjs [shot-dir]
// One card per site with its license on it (plan badge, connectors, term), Open Console as the primary action,
// Rename / Manage controller inline, unused licenses in their own section, never 'default-site' or a hostname as a name,
// no sideways scrolling at phone width. Demo data only; screenshots carry a DEMO label.
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';

const SHOTS = (process.argv[2] ?? new URL('./shots/', import.meta.url).pathname).replace(/\/?$/, '/'); mkdirSync(SHOTS, { recursive: true });
const EMAIL = 'demo@example.test';
const stack = await startStack();
const now = Date.now(), DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();

const L = (id, o) => ({ id, email: EMAIL, plan: 'pro', site_id: 'default-site', connector_limit: 5, expires_at: null, status: 'active', notes: '',
  created_at: iso(now - 40 * DAY), token: 'tok-' + id + '-' + 'a'.repeat(24), ...o });
const licenses = [
  L('lic-hq', { plan: 'founder', connector_limit: 0, site_name: 'Head office', claimed_by: '1a'.repeat(32), claimed_hostname: 'nanopi-r3s' }),
  L('lic-wh', { plan: 'founder', connector_limit: 0, site_name: 'Warehouse', minted_from: 'lic-hq', claimed_by: '2b'.repeat(32), claimed_hostname: 'hp-prodesk-400' }),
  L('lic-br', { plan: 'pro', site_name: 'Branch Utrecht', claimed_by: '3c'.repeat(32), claimed_hostname: 'acer-veriton', expires_at: iso(now + 200 * DAY) }),
  L('lic-add', { plan: 'addon_connector', connector_limit: 3, parent_id: 'lic-br' }),
  L('lic-spare', { plan: 'pro', expires_at: iso(now + 300 * DAY) }),
  L('lic-home', { plan: 'home', connector_limit: 2 }),
  L('lic-other', { email: 'someone@else.test', site_name: 'Not yours', claimed_by: '4d'.repeat(32) }),
];
for (const l of licenses) { stack.kv.set('license:' + l.id, JSON.stringify(l)); stack.kv.set('index:token:' + l.token, l.id); }
stack.kv.set('index:all', JSON.stringify(licenses.map((l) => l.id)));
const dev = (name, ups_status, battery_pct, load_pct, runtime_sec, state = 'online') => ({ name, state, version: '0.1.115', ups_status, battery_pct, load_pct, runtime_sec, last_seen: Math.floor(now / 1000) });
const status = (o) => JSON.stringify({ site_name: 'default-site', controller_version: '0.1.115', devices: [], received_at: Date.now(), ...o });
stack.kv.set('sitestatus:lic-hq', status({ model: 'NanoPi R3S', devices: [dev('Eaton 5PX 1500 — server rack', 'OL', 100, 24, 3120), dev('APC Smart-UPS 1000 — network', 'OL CHRG', 96, 31, 2280), dev('CyberPower OR600 — CCTV', 'OL', 100, 12, 5400)] }));
stack.kv.set('sitestatus:lic-wh', status({ model: 'HP ProDesk 400 G3 DM', devices: [dev('Eaton Ellipse PRO 850', 'OL', 100, 18, 2700)] }));
stack.kv.set('sitestatus:lic-br', status({ model: 'Acer Veriton', received_at: now - 3 * 3600_000, devices: [dev('APC Back-UPS 700', 'OL', 100, 9, 1800)] }));
stack.kv.set('mfa:' + EMAIL, JSON.stringify({ v: 1, totp: 'demo', created_at: iso(now - 20 * DAY), last_step: 0, recovery: Array(10).fill('x'), recovery_created_at: iso(now - 20 * DAY) }));
const sid = randomBytes(32).toString('hex');
stack.kv.set('session:' + sid, JSON.stringify({ email: EMAIL, expires: now + DAY, mfa: true }));
const cookie = { name: 'pg_session', value: sid, domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' };

const browser = await webkit.launch();
const demo = (page) => page.evaluate(() => {
  const b = document.createElement('div');
  b.textContent = 'DEMO';
  b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:3px 9px;border-radius:6px;background:#f59e0b;color:#000;font:700 11px/1.4 system-ui;letter-spacing:.12em';
  document.body.appendChild(b);
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()); // next dev's own badge, not part of the page
});
const card = (page, name) => page.locator('article.site-card', { has: page.locator('.site-name', { hasText: name }) });

try {
  const phone = await browser.newContext({ ...devices['iPhone 15'], userAgent: IPHONE_UA, ignoreHTTPSErrors: true });
  await phone.addCookies([cookie]);
  const page = await phone.newPage();
  await page.goto(BASE + '/account');
  await hydrated(page, 'button[data-action=rename]');

  console.log('header');
  check('"My sites" heading', (await page.locator('h1').textContent()) === 'My sites');
  const chips = (await page.locator('#account-chips li').allTextContents()).join(' · ');
  check('summary chips instead of a totals box', chips === '3 sites · 2 online · 1 offline · Founder · Pro · 2 licenses not in use', chips);
  check('no "Total connectors" box any more', !(await page.locator('body').innerText()).includes('Total connectors'));

  console.log('\none card per site, license on the card');
  check('three site cards, only this account’s', await page.locator('article.site-card').count() === 3 && !(await page.locator('body').innerText()).includes('Not yours'));
  const hq = card(page, 'Head office');
  check('Head office: Founder badge on the card', (await hq.locator('.site-plan').textContent()) === 'Founder');
  check('Head office: "Online · 0.1.115"', (await hq.locator('.site-line').textContent()).startsWith('Online · 0.1.115'));
  check('Head office: connectors and term from its license', (await hq.locator('.site-license').innerText()).includes('3 connectors · unlimited') && (await hq.locator('.site-license').innerText()).includes('Never expires'));
  const br = card(page, 'Branch Utrecht');
  check('Branch Utrecht: Pro badge, capacity with its add-on (5 + 3)', (await br.locator('.site-plan').textContent()) === 'Pro' && (await br.locator('.site-license').innerText()).includes('1 of 8 connectors'));
  check('Branch Utrecht: offline, last seen', (await br.locator('.site-line').textContent()).startsWith('Offline · last seen 3 h ago'));
  check('Open Console (green) on online Pro/Founder sites only', await hq.locator('button.open-console').isVisible() && await br.locator('button.open-console').count() === 0 && (await br.innerText()).includes('Console available when the site is online'));
  check('no separate license cards below the sites', await page.locator('text=FOUNDER default-site').count() === 0);

  console.log('\nunused licenses');
  const unused = page.locator('#unused-licenses');
  check('"Licenses not in use" section with the 2 free licenses', await unused.isVisible() && await unused.locator('li.unused-license').count() === 2);
  check('…with how to use them', (await unused.innerText()).includes('Settings → License'));
  check('…the add-on is not listed as a license', !(await unused.innerText()).includes('addon'));

  console.log('\nnames');
  const text = await page.locator('body').innerText();
  check('no "default-site" anywhere on the page', !/default-site/i.test(text) && !/default-site/.test(await page.content()));
  check('no hostname shown as a name', !/nanopi-r3s|hp-prodesk-400|acer-veriton/.test(text));

  console.log('\nphone layout');
  check('no sideways scrolling at iPhone width', await noSideScroll(page));
  check('devices as stacked rows, no wide table', await page.locator('table').count() === 0 && await hq.locator('li.device').count() === 3);
  const ob = await hq.locator('button.open-console').boundingBox();
  check('Open Console is easy to tap (≥ 44 px)', !!ob && ob.height >= 44, String(ob?.height));
  await demo(page);
  await page.screenshot({ path: SHOTS + 'account-ui-iphone.png', fullPage: true });

  console.log('\ninline actions (no modal, no toast)');
  await hq.locator('button[data-action=manage]').tap();
  check('Manage controller opens inside the card', (await hq.innerText()).includes('Release this site'));
  await hq.screenshot({ path: SHOTS + 'account-ui-iphone-manage.png' });
  await hq.locator('button[data-action=manage]').tap();
  await card(page, 'Warehouse').locator('button[data-action=rename]').tap();
  const field = page.locator('#n-lic-wh');
  check('Rename opens a field in the card, filled with the name', await field.isVisible() && (await field.inputValue()) === 'Warehouse');
  check('no dialog or toast', await page.locator('[role=dialog]:not([aria-hidden=true]), [role=status], [role=alertdialog]').count() === 0);
  check('rename panel: no sideways scrolling', await noSideScroll(page));
  await field.fill('Warehouse North');
  await card(page, 'Warehouse').getByRole('button', { name: 'Save' }).tap();
  await page.locator('.site-name', { hasText: 'Warehouse North' }).waitFor({ timeout: 15000 });
  check('saving renames the site', JSON.parse(stack.kv.get('license:lic-wh')).site_name === 'Warehouse North');

  console.log('\nOpen Console (relay session)');
  let asked = null;
  await page.route('**/api/account/relay-session', async (route) => { asked = route.request().postDataJSON(); await route.fulfill({ json: { console_url: 'https://example.test/console/demo' } }); });
  let opened = '';
  await phone.route('https://example.test/**', (route) => { opened = route.request().url(); route.fulfill({ contentType: 'text/html', body: '<p>console</p>' }); });
  const [popup] = await Promise.all([page.waitForEvent('popup'), card(page, 'Head office').locator('button.open-console').tap()]);
  for (let i = 0; i < 50 && !opened; i++) await page.waitForTimeout(100);
  check('asks a short-lived session for this site’s license and opens it in a new tab', asked?.license_id === 'lic-hq' && opened === 'https://example.test/console/demo', JSON.stringify(asked) + ' ' + opened);
  await popup.close();

  console.log('\na site without a usable name');
  const wh = JSON.parse(stack.kv.get('license:lic-wh')); delete wh.site_name;
  stack.kv.set('license:lic-wh', JSON.stringify(wh));
  await page.reload();
  await page.locator('article.site-card').first().waitFor();
  check('controller reports "default-site": the card says "Unnamed site"', await card(page, 'Unnamed site').count() === 1 && !/default-site/i.test(await page.locator('body').innerText()));
  wh.site_name = 'Warehouse'; stack.kv.set('license:lic-wh', JSON.stringify(wh));

  console.log('\ndesktop');
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  await desk.addCookies([cookie]);
  const dp = await desk.newPage();
  await dp.goto(BASE + '/account');
  await dp.locator('article.site-card').first().waitFor();
  check('desktop: device table header row is shown', await card(dp, 'Head office').getByText('Runtime', { exact: true }).isVisible());
  check('desktop: no sideways scrolling', await noSideScroll(dp));
  await demo(dp);
  await dp.screenshot({ path: SHOTS + 'account-ui-desktop.png', fullPage: true });

  console.log('\nan account with only an unused license');
  for (const id of ['lic-hq', 'lic-wh', 'lic-br']) { const l = JSON.parse(stack.kv.get('license:' + id)); stack.kv.set('license:' + id, JSON.stringify({ ...l, email: 'gone@else.test' })); }
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.goto(BASE + '/account');
  await page.locator('#unused-licenses').waitFor();
  check('no site cards, the unused list and a hint', await page.locator('article.site-card').count() === 0 && (await page.locator('body').innerText()).includes('No controller is linked yet'));
} catch (e) {
  check('no exception', false, String(e?.message ?? e).split('\n')[0]);
  for (const [i, pg] of browser.contexts().flatMap((c) => c.pages()).entries()) {
    await pg.screenshot({ path: SHOTS + `fail-account-${i}.png`, fullPage: true }).catch(() => {});
    console.log('page', i, pg.url(), (await pg.locator('body').innerText().catch(() => '')).slice(0, 600).replace(/\n+/g, ' | '));
  }
  console.log(stack.log.text.split('\n').filter((l) => /error|warn/i.test(l)).slice(-15).join('\n'));
} finally {
  await browser.close();
  stack.stop();
}
const { passed, failed } = result();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
