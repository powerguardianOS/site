// Tester waitlist: the call to action on the home and pricing page, the /tester form on an iPhone (WebKit) and a
// desktop, the confirmation mail, and the admin list (admin only, CSV, no HTML from sign-ups). Demo data only; screenshots carry a DEMO label.
//   cd tests/e2e && npm install && node tester.e2e.mjs [shot-dir]
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';

const SHOTS = (process.argv[2] ?? new URL('./shots/', import.meta.url).pathname).replace(/\/?$/, '/'); mkdirSync(SHOTS, { recursive: true });
const stack = await startStack();
const DAY = 86_400_000;
const session = (email) => {
  const sid = randomBytes(32).toString('hex');
  stack.kv.set('session:' + sid, JSON.stringify({ email, expires: Date.now() + DAY, mfa: true }));
  return { name: 'pg_session', value: sid, domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' };
};
const demo = (page) => page.evaluate(() => {
  const b = document.createElement('div');
  b.textContent = 'DEMO';
  b.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top) + 10px);right:10px;z-index:9999;padding:3px 9px;border-radius:6px;background:#f59e0b;color:#000;font:700 11px/1.4 system-ui;letter-spacing:.12em';
  document.body.appendChild(b);
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove());
});
const PEOPLE = {
  iphone: { email: 'sanne@demo.example', name: 'Sanne', country: 'Netherlands', ups: 'Eaton 5PX 1500', protects: ['nas', 'network'], count: '2', heard: 'Tweakers forum' },
  desktop: { email: 'ops@demo-bv.example', name: '', country: 'Belgium', ups: 'APC Smart-UPS 1500 + CyberPower OR600', protects: ['servers', 'network'], count: '3', heard: 'LinkedIn' },
};

const browser = await webkit.launch();
try {
  for (const [name, opts] of [
    ['iphone', { ...devices['iPhone 15'], userAgent: IPHONE_UA }],
    ['desktop', { viewport: { width: 1280, height: 900 } }],
  ]) {
    console.log(name);
    const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam' });
    const page = await ctx.newPage();

    for (const [path, shot] of [['/', 'pricing-home-cta'], ['/pricing', 'pricing-tester-cta']]) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      const cta = page.locator('[data-cta="tester"]');
      check(`${path}: tester call to action is there, links to /tester`,
        ((await cta.textContent()) ?? '').includes('Become a tester') && ((await cta.textContent()) ?? '').includes('free during the beta') && ((await cta.textContent()) ?? '').includes('We invite in small groups') && (await cta.locator('a[href="/tester"]').count()) === 1);
      check(`${path}: no sideways scrolling`, await noSideScroll(page));
      await cta.scrollIntoViewIfNeeded();
      await demo(page);
      await cta.screenshot({ path: `${SHOTS}${shot}-${name}.png` });
    }

    await page.click('[data-cta="tester"] a[href="/tester"]');
    await page.waitForURL(BASE + '/tester');
    await hydrated(page, '#t-email');
    check('/tester: no sideways scrolling', await noSideScroll(page));
    check('honeypot field is not visible', !(await page.locator('#t-website').isVisible()) || (await page.locator('#t-website').boundingBox()).x < 0);

    // Submit without consent: the server says why, nothing stored.
    const p = PEOPLE[name];
    await page.fill('#t-email', p.email);
    if (p.name) await page.fill('#t-name', p.name);
    await page.fill('#t-country', p.country);
    await page.fill('#t-ups', p.ups);
    for (const v of p.protects) await page.check(`input[name=protects][value=${v}]`);
    await page.fill('#t-count', p.count);
    await page.fill('#t-heard', p.heard);
    await page.click('button[type=submit]');
    await page.waitForSelector('#tester-error');
    check('without consent: a clear message, nothing stored', ((await page.textContent('#tester-error')) ?? '').includes('contact') && !stack.kv.has('tester:' + p.email));
    await page.check('input[name=consent]');
    check('changing the form clears the old message', (await page.locator('#tester-error').count()) === 0);
    await demo(page);
    await page.screenshot({ path: `${SHOTS}tester-form-${name}.png`, fullPage: true });
    await page.click('button[type=submit]');
    await page.waitForSelector('#tester-done');
    check('sign-up done: waitlist confirmation shown inline, stored, confirmation mailed',
      ((await page.textContent('#tester-done')) ?? '').includes('waitlist') && ((await page.textContent('#tester-done')) ?? '').includes('small groups') &&
      stack.kv.has('tester:' + p.email) && stack.mails.some((m) => m.to === p.email && /waitlist/i.test(m.subject)));
    await demo(page);
    await page.screenshot({ path: `${SHOTS}tester-done-${name}.png`, fullPage: true });
    await ctx.close();
  }

  console.log('admin');
  // A sign-up that tries to inject HTML and a spreadsheet formula.
  const evil = { email: 'evil@demo.example', name: '<img src=x onerror=alert(1)>', country: '=1+1', ups: '<b>UPS</b>', protects: ['other'], ups_count: 1, heard: '', consent: true };
  const api = await browser.newContext({ ignoreHTTPSErrors: true });
  check('an HTML/formula sign-up is accepted as plain text', (await api.request.post(BASE + '/api/tester', { data: evil })).status() === 200);
  await api.close();
  const anon = await browser.newContext({ ignoreHTTPSErrors: true });
  check('anonymous: the API list is refused (401)', (await anon.request.get(BASE + '/api/admin/testers')).status() === 401);
  const ap = await anon.newPage();
  await ap.goto(BASE + '/admin/testers');
  check('anonymous: /admin/testers sends you to sign in', new URL(ap.url()).pathname === '/login');
  await anon.close();

  const cust = await browser.newContext({ ignoreHTTPSErrors: true });
  await cust.addCookies([session(PEOPLE.iphone.email)]);
  check('a signed-in customer: list and CSV refused (401)',
    (await cust.request.get(BASE + '/api/admin/testers')).status() === 401 && (await cust.request.get(BASE + '/api/admin/testers?format=csv')).status() === 401);
  const cp = await cust.newPage();
  await cp.goto(BASE + '/admin/testers');
  check('a signed-in customer: /admin/testers is not shown', new URL(cp.url()).pathname === '/login');
  await cust.close();

  for (const [name, opts] of [['iphone', { ...devices['iPhone 15'], userAgent: IPHONE_UA }], ['desktop', { viewport: { width: 1280, height: 900 } }]]) {
    const adm = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam' });
    await adm.addCookies([session('admin@powerguardian.cloud')]);
    const page = await adm.newPage();
    await page.goto(BASE + '/admin/testers', { waitUntil: 'networkidle' });
    const txt = (await page.textContent('#tester-list').catch(() => '')) ?? '';
    check(`admin (${name}): all sign-ups listed`, txt.includes(PEOPLE.iphone.email) && txt.includes(PEOPLE.desktop.email) && txt.includes(evil.email));
    check(`admin (${name}): sign-up text is shown as text, never as HTML`, txt.includes(evil.name) && (await page.locator('#tester-list img, #tester-list b').count()) === 0);
    check(`admin (${name}): no sideways scrolling`, await noSideScroll(page));
    const csv = await adm.request.get(BASE + '/api/admin/testers?format=csv');
    const csvText = await csv.text();
    check(`admin (${name}): CSV export, formulas neutralised`, csv.status() === 200 && csvText.includes(PEOPLE.desktop.ups) && csvText.includes(`"'=1+1"`));
    await demo(page);
    await page.screenshot({ path: `${SHOTS}tester-admin-${name}.png`, fullPage: true });
    await adm.close();
  }
} catch (e) { check('script error: ' + (e?.message ?? e), false); }
finally {
  await browser.close();
  stack.stop();
  const { passed, failed } = result();
  console.log(`\n${passed} passed, ${failed} failed`);
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}
