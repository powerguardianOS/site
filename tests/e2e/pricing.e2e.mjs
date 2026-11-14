// The pricing page on an iPhone (WebKit) and on a desktop: yearly is selected by default ("2 months free"), the
// monthly/yearly toggle shows exactly the numbers of app/lib/pricing.ts (the table PayPal charges from), the docs and
// the meta description show the same numbers, Business is "coming soon" with Contact us and no checkout, and nothing
// scrolls sideways on a phone. Screenshots carry a DEMO label.
//   cd tests/e2e && npm install && node pricing.e2e.mjs [shot-dir]
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';
import { PRICING, eur, monthsFree } from '../../app/lib/pricing.ts';

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
    await hydrated(page, 'button[data-period="year"]');

    check('yearly is selected by default', (await page.locator('button[data-period="year"]').getAttribute('aria-checked')) === 'true');
    check('the toggle says "2 months free"', ((await page.locator('button[data-period="year"]').textContent()) ?? '').includes(`${monthsFree('home')} months free`));
    check(`yearly prices: Home ${eur(PRICING.home.year)}, Pro ${eur(PRICING.pro.year)}`,
      (await priceOn(page, 'home')) === eur(PRICING.home.year) && (await priceOn(page, 'pro')) === eur(PRICING.pro.year));
    check('VAT note is shown', ((await page.textContent('body')) ?? '').includes('incl. VAT'));
    check('no sideways scrolling', await noSideScroll(page));
    await demo(page);
    await page.screenshot({ path: `${SHOTS}pricing-${name}-yearly.png`, fullPage: true });

    await page.click('button[data-period="month"]');
    await page.waitForTimeout(400); // let the toggle's colour transition finish before the screenshot
    check('after a tap, Monthly is selected', (await page.locator('button[data-period="month"]').getAttribute('aria-checked')) === 'true' && (await page.locator('button[data-period="year"]').getAttribute('aria-checked')) === 'false');
    check(`monthly prices: Home ${eur(PRICING.home.month)}, Pro ${eur(PRICING.pro.month)}`,
      (await priceOn(page, 'home')) === eur(PRICING.home.month) && (await priceOn(page, 'pro')) === eur(PRICING.pro.month));
    check('no sideways scrolling (monthly)', await noSideScroll(page));
    await page.screenshot({ path: `${SHOTS}pricing-${name}-monthly.png`, fullPage: true });

    const biz = page.locator('[data-plan="business"]');
    check('Business: coming soon, Contact us by mail, no checkout button',
      ((await biz.textContent()) ?? '').includes('COMING SOON') &&
      ((await biz.locator('a').getAttribute('href')) ?? '').startsWith('mailto:') && (await biz.locator('button').count()) === 0);
    check('Founder is not offered as a plan', !/founder/i.test((await page.textContent('main, body')) ?? ''));
    await ctx.close();
  }

  console.log('same numbers everywhere');
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/pricing', { waitUntil: 'networkidle' });
  const meta = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
  check('meta description has the new prices', meta.includes(`${eur(PRICING.home.month)}/month or ${eur(PRICING.home.year)}/year`) && meta.includes(`${eur(PRICING.pro.month)}/month or ${eur(PRICING.pro.year)}/year`), meta);
  const html = await (await ctx.request.get(BASE + '/docs')).text();
  check('docs show the new prices', html.includes(`Home ${eur(PRICING.home.month)}/month or ${eur(PRICING.home.year)}/year`) && html.includes(`Pro ${eur(PRICING.pro.month)}/month or ${eur(PRICING.pro.year)}/year`));
  check('no old price anywhere on pricing or docs', !/€2\.99\/mo\b|€9\.99|€99\b/.test(html + (await page.content())));
  await ctx.close();
} catch (e) { check('script error: ' + (e?.message ?? e), false); }
finally {
  await browser.close();
  stack.stop();
  const { passed, failed } = result();
  console.log(`\n${passed} passed, ${failed} failed`);
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}
