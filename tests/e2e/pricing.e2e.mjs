// The pricing page on an iPhone (WebKit) and on a desktop: yearly prices only (no monthly toggle), exactly the numbers
// of app/lib/pricing.ts (the table PayPal charges from), Pro says 1 site, the docs and the meta description show the
// same numbers, Business is "coming soon" with Contact us (mail) and no checkout, and nothing scrolls sideways on a
// phone. Screenshots carry a DEMO label.
//   cd tests/e2e && npm install && node pricing.e2e.mjs [shot-dir]
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';
import { PRICING, eur } from '../../app/lib/pricing.ts';
import { CONTACT_EMAIL } from '../../app/lib/contact.ts';

const SHOTS = (process.argv[2] ?? new URL('./shots/', import.meta.url).pathname).replace(/\/?$/, '/'); mkdirSync(SHOTS, { recursive: true });
const stack = await startStack();
const demo = (page) => page.evaluate(() => {
  const b = document.createElement('div');
  b.textContent = 'DEMO';
  b.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top) + 10px);right:10px;z-index:9999;padding:3px 9px;border-radius:6px;background:#f59e0b;color:#000;font:700 11px/1.4 system-ui;letter-spacing:.12em';
  document.body.appendChild(b);
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove());
});
const priceOn = (page, plan) => page.locator(`[data-plan="${plan}"] [data-price]`).first().textContent();

const browser = await webkit.launch();
try {
  for (const [name, opts] of [
    ['iphone', { ...devices['iPhone 15'], userAgent: IPHONE_UA }],
    ['desktop', { viewport: { width: 1280, height: 900 } }],
  ]) {
    console.log(name);
    const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/pricing', { waitUntil: 'networkidle' });
    await hydrated(page, '[data-plan="pro"] [data-price]');

    check('no monthly/yearly toggle, no monthly price', (await page.locator('[data-period], [role="radiogroup"]').count()) === 0 && !/\/month\b|monthly/i.test((await page.textContent('body')) ?? ''));
    check(`yearly prices: Home ${eur(PRICING.home.year)}, Pro ${eur(PRICING.pro.year)}, add-on ${eur(PRICING.addon_connector.year)}`,
      (await priceOn(page, 'home')) === eur(PRICING.home.year) && (await priceOn(page, 'pro')) === eur(PRICING.pro.year) && (await priceOn(page, 'addon_connector')) === eur(PRICING.addon_connector.year));
    check('Pro card says 1 site', ((await page.locator('[data-plan="pro"]').textContent()) ?? '').includes('1 site,'));
    check('checkout stays closed: no PayPal, buttons disabled', (await page.locator('[data-plan="home"] button:enabled, [data-plan="pro"] button:enabled').count()) === 0 && !(await page.content()).includes('paypal.com/sdk'));
    check('VAT note is shown', ((await page.textContent('body')) ?? '').includes('incl. VAT'));
    check('no sideways scrolling', await noSideScroll(page));
    await demo(page);
    await page.screenshot({ path: `${SHOTS}pricing-${name}.png`, fullPage: true });

    const biz = page.locator('[data-plan="business"]');
    check('Business: coming soon, Contact us by mail, no checkout button',
      ((await biz.textContent()) ?? '').includes('COMING SOON') &&
      ((await biz.locator('a').getAttribute('href')) ?? '').startsWith(`mailto:${CONTACT_EMAIL}?`) && (await biz.locator('button').count()) === 0);
    check('Founder is not offered as a plan', !/founder/i.test((await page.textContent('main, body')) ?? ''));
    await ctx.close();
  }

  console.log('same numbers everywhere');
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/pricing', { waitUntil: 'networkidle' });
  const meta = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
  check('meta description has the yearly prices', meta.includes(`Home ${eur(PRICING.home.year)}/year`) && meta.includes(`Pro ${eur(PRICING.pro.year)}/year`) && !/month/i.test(meta), meta);
  const html = await (await ctx.request.get(BASE + '/docs')).text();
  check('docs show the yearly prices and the contact address', html.includes(`Home ${eur(PRICING.home.year)}/year`) && html.includes(`Pro ${eur(PRICING.pro.year)}/year`) && html.includes(CONTACT_EMAIL));
  check('no old or monthly price anywhere on pricing or docs', !/€2\.99|€9\.99|€99\b|€4\.99|€14\.99|\/month/.test(html + (await page.content())));
  await ctx.close();
} catch (e) { check('script error: ' + (e?.message ?? e), false); }
finally {
  await browser.close();
  stack.stop();
  const { passed, failed } = result();
  console.log(`\n${passed} passed, ${failed} failed`);
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}
