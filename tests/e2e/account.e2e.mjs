// ACCOUNT-UI in a phone browser (WebKit iPhone) and on a desktop width.
//   cd tests/e2e && npm install && PATH=~/dev/.tools/node/bin:$PATH node account.e2e.mjs [shot-dir]
//   ACCOUNT_LOOK=b node account.e2e.mjs [shot-dir]      (the second look, while the owner chooses)
// "My sites": one calm tile per site (name, status, 24 h power), the whole tile opens the console, "⋯" opens Rename /
// Controller inline, licenses not in use and the account are one quiet line each. Never 'default-site' or a hostname
// as a name, never stale "on mains" for an offline site, no sideways scrolling at phone width. Demo data only;
// screenshots carry a DEMO label.
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';

const LOOK = process.env.ACCOUNT_LOOK === 'b' ? 'b' : 'a';
const SHOTS = (process.argv[2] ?? new URL('./shots/', import.meta.url).pathname).replace(/\/?$/, '/'); mkdirSync(SHOTS, { recursive: true });
const EMAIL = 'demo@example.test';
const stack = await startStack(); // next dev inherits ACCOUNT_LOOK from this process
const now = Date.now(), DAY = 86_400_000, SLOT = 30 * 60_000, at = Math.floor(now / SLOT);
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
// Head office: 24 h on mains with a 1 h power cut 9 h ago. Branch: on mains until it went silent 3 h ago. Warehouse: no history
// yet (its last record predates the power line), on battery right now.
const hqHist = { at, s: 'm'.repeat(29) + 'bb' + 'm'.repeat(17) };
const brHist = { at: at - 6, s: '-'.repeat(10) + 'm'.repeat(38) };
stack.kv.set('sitestatus:lic-hq', status({ model: 'NanoPi R3S', power: hqHist, devices: [dev('Eaton 5PX 1500', 'OL', 100, 24, 3120), dev('APC Smart-UPS 1000', 'OL CHRG', 96, 31, 2280), dev('CyberPower OR600', 'OL', 100, 12, 5400)] }));
stack.kv.set('sitestatus:lic-wh', status({ model: 'HP ProDesk 400 G3 DM', devices: [dev('Eaton Ellipse PRO 850', 'OB DISCHRG', 71, 18, 1500)] }));
stack.kv.set('sitestatus:lic-br', status({ model: 'Acer Veriton', power: brHist, received_at: now - 3 * 3600_000, devices: [dev('APC Back-UPS 700', 'OL', 100, 9, 1800)] }));
stack.kv.set('mfa:' + EMAIL, JSON.stringify({ v: 1, totp: 'demo', created_at: iso(now - 20 * DAY), last_step: 0, recovery: Array(10).fill('x'), recovery_created_at: iso(now - 20 * DAY) }));
const sid = randomBytes(32).toString('hex');
stack.kv.set('session:' + sid, JSON.stringify({ email: EMAIL, expires: now + DAY, mfa: true }));
const cookie = { name: 'pg_session', value: sid, domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' };

const browser = await webkit.launch();
const demo = (page) => page.evaluate((look) => {
  const b = document.createElement('div');
  b.textContent = 'DEMO · look ' + look.toUpperCase();
  b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;padding:3px 9px;border-radius:6px;background:#f59e0b;color:#000;font:700 11px/1.4 system-ui;letter-spacing:.12em';
  document.body.appendChild(b);
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()); // next dev's own badge, not part of the page
}, LOOK);
const tile = (page, name) => page.locator('article.site-card', { has: page.locator('.site-name', { hasText: name }) });
const slotsOf = (t) => t.locator('[data-slots]').getAttribute('data-slots'); // 48 half hours, oldest first

try {
  console.log(`look ${LOOK}`);
  const phone = await browser.newContext({ ...devices['iPhone 15'], userAgent: IPHONE_UA, ignoreHTTPSErrors: true });
  await phone.addCookies([cookie]);
  const page = await phone.newPage();
  await page.goto(BASE + '/account');
  await hydrated(page, 'button[data-action=more]');

  console.log('header: just "My sites"');
  check('"My sites" heading, no summary chips', (await page.locator('h1').textContent()) === 'My sites' && await page.locator('#account-chips').count() === 0);
  check('no "Total connectors" box', !(await page.locator('body').innerText()).includes('Total connectors'));

  console.log('\none tile per site, health at a glance');
  check('three site tiles (only this account’s) and an "+ Add site" tile', await page.locator('article.site-card').count() === 3 && !(await page.locator('body').innerText()).includes('Not yours') && await page.locator('#add-site').isVisible());
  const hq = tile(page, 'Head office'), wh = tile(page, 'Warehouse'), br = tile(page, 'Branch Utrecht');
  check('plan badge on the tile', (await hq.locator('.site-plan').textContent()) === 'Founder' && (await br.locator('.site-plan').textContent()) === 'Pro');
  check('online, all on mains: "3 UPSes on mains" (+ the model)', (await hq.innerText()).includes('3 UPSes on mains') && (await hq.innerText()).includes('NanoPi R3S'));
  if (LOOK === 'a') check('look a: the status word is "Guarded"', (await hq.locator('.site-word').textContent()) === 'Guarded');
  check('a UPS on battery: "On battery · 1 UPS" in amber', (await wh.innerText()).includes('1 UPS') && (await wh.innerText()).includes('On battery') && /amber/.test(await wh.locator(LOOK === 'a' ? '.site-word >> xpath=..' : '.site-line').getAttribute('class')));
  check('offline: "Offline · last seen 3 h ago", never a stale "on mains"', (await br.innerText()).includes('last seen 3 h ago') && !/mains/i.test(await br.innerText()));
  check('no device table, no connectors/term facts on the tile', await page.locator('table, li.device').count() === 0 && !(await hq.innerText()).includes('Never expires'));

  console.log('\n24 h power');
  const hqSlots = await slotsOf(hq);
  check('Head office shows the power cut 9 h ago in amber, on mains otherwise', hqSlots.includes('b') && hqSlots.includes('m') && !hqSlots.includes('-'), hqSlots);
  const brSlots = await slotsOf(br);
  check('Branch: on mains until it went silent, no data after (nothing invented)', brSlots.includes('m') && /-$/.test(brSlots) && !brSlots.includes('b'), brSlots);
  check('Warehouse has no history yet: grey, and says so', !(await slotsOf(wh)).replace(/-/g, '') && /history yet|next heartbeat/.test(await wh.innerText()));

  console.log('\nnames');
  const text = await page.locator('body').innerText();
  check('no "default-site" anywhere (text or page source)', !/default-site/i.test(text) && !/default-site/.test(await page.content()));
  check('no hostname shown', !/nanopi-r3s|hp-prodesk-400|acer-veriton/.test(text));

  console.log('\nphone layout');
  check('no sideways scrolling at iPhone width', await noSideScroll(page));
  const w = await hq.boundingBox();
  check('tiles in one column on the phone', !!w && w.width > 300);
  await demo(page);
  await page.screenshot({ path: SHOTS + `account-ui-${LOOK}-iphone.png`, fullPage: true });

  console.log('\nthe whole tile opens the console');
  check('online Pro/Founder tiles are clickable, the offline one is not', (await hq.getAttribute('data-clickable')) === 'yes' && (await br.getAttribute('data-clickable')) === 'no' && await br.locator('button.open-console').count() === 0);
  check('with a visible "Open ↗"', (await hq.locator('.open-affordance').textContent()) === 'Open ↗');
  let asked = null, opened = '';
  await page.route('**/api/account/relay-session', async (route) => { asked = route.request().postDataJSON(); await route.fulfill({ json: { console_url: 'https://example.test/console/demo' } }); });
  await phone.route('https://example.test/**', (route) => { opened = route.request().url(); route.fulfill({ contentType: 'text/html', body: '<p>console</p>' }); });
  const box = await hq.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); // the middle of the tile (power line)
  for (let i = 0; i < 50 && !opened; i++) await page.waitForTimeout(100);
  check('tapping the tile asks a short-lived session for this site and opens it in a new tab', asked?.license_id === 'lic-hq' && opened === 'https://example.test/console/demo', JSON.stringify(asked) + ' ' + opened);
  for (const p of phone.pages()) if (p !== page) await p.close();

  console.log('\n"⋯": details, Rename and Controller inline (no modal, no toast)');
  asked = null;
  await hq.locator('button[data-action=more]').tap();
  check('"⋯" opens a quiet license line in the tile, does not open the console', (await hq.locator('.site-more').innerText()).includes('3 connectors · unlimited · Never expires') && asked === null);
  await hq.locator('button[data-action=manage]').tap();
  check('Controller opens inside the tile', (await hq.innerText()).includes('Release this site'));
  check('no dialog or toast', await page.locator('[role=dialog]:not([aria-hidden=true]), [role=status], [role=alertdialog]').count() === 0);
  check('open panel: no sideways scrolling', await noSideScroll(page));
  await hq.screenshot({ path: SHOTS + `account-ui-${LOOK}-iphone-more.png` });
  await hq.locator('button[data-action=more]').tap();
  await wh.locator('button[data-action=more]').tap();
  await wh.locator('button[data-action=rename]').tap();
  const field = page.locator('#n-lic-wh');
  check('Rename: a field in the tile, filled with the name', await field.isVisible() && (await field.inputValue()) === 'Warehouse');
  await field.fill('Warehouse North');
  await wh.getByRole('button', { name: 'Save' }).tap();
  await page.locator('.site-name', { hasText: 'Warehouse North' }).waitFor({ timeout: 15000 });
  check('saving renames the site', JSON.parse(stack.kv.get('license:lic-wh')).site_name === 'Warehouse North');

  console.log('\nquiet lines');
  const unused = page.locator('#unused-licenses');
  check('"2 licenses not in use · How to use" as one line', (await unused.locator('summary').innerText()).trim() === '2 licenses not in use · How to use' && !(await unused.locator('li.unused-license').first().isVisible()));
  await unused.locator('summary').tap();
  check('…expands inline with how to use and the 2 licenses (no add-on)', await unused.locator('li.unused-license').count() === 2 && (await unused.innerText()).includes('Settings → License') && await unused.locator('li.unused-license').first().isVisible());
  check('Account: "Two-step sign-in: On · Manage" and "+ Add licenses"', (await page.locator('#two-step-state').textContent()) === 'On' && (await page.locator('#two-step-manage').textContent()) === 'Manage' && await page.locator('#add-licenses').isVisible());
  check('"+ Add site" leads to the unused licenses, opened', (await page.locator('#add-site').getAttribute('href')).includes('add=1'));

  console.log('\na site without a usable name');
  const whRec = JSON.parse(stack.kv.get('license:lic-wh')); delete whRec.site_name;
  stack.kv.set('license:lic-wh', JSON.stringify(whRec));
  await page.goto(BASE + '/account?add=1');
  await page.locator('article.site-card').first().waitFor();
  check('controller reports "default-site": the tile says "Unnamed site"', await tile(page, 'Unnamed site').count() === 1 && !/default-site/i.test(await page.locator('body').innerText()));
  check('?add=1 opens the unused licenses', await page.locator('#unused-licenses li.unused-license').first().isVisible());
  whRec.site_name = 'Warehouse'; stack.kv.set('license:lic-wh', JSON.stringify(whRec));

  console.log('\ndesktop');
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  await desk.addCookies([cookie]);
  const dp = await desk.newPage();
  await dp.goto(BASE + '/account');
  await dp.locator('article.site-card').first().waitFor();
  const tops = await dp.locator('article.site-card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  check('desktop: tiles side by side in a grid', new Set(tops).size < tops.length, tops.join(','));
  check('desktop: no sideways scrolling', await noSideScroll(dp));
  await demo(dp);
  await dp.screenshot({ path: SHOTS + `account-ui-${LOOK}-desktop.png`, fullPage: true });

  console.log('\nan account with only unused licenses');
  for (const id of ['lic-hq', 'lic-wh', 'lic-br']) { const l = JSON.parse(stack.kv.get('license:' + id)); stack.kv.set('license:' + id, JSON.stringify({ ...l, email: 'gone@else.test' })); }
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.goto(BASE + '/account');
  await page.locator('#unused-licenses').waitFor();
  check('no site tiles, the "+ Add site" tile and the unused line', await page.locator('article.site-card').count() === 0 && await page.locator('#add-site').isVisible());
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
