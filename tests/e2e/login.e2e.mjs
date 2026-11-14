// LOGIN-1 in a phone browser (WebKit = Safari and Chrome on iPhone).
//   cd tests/e2e && npm install && PATH=~/dev/.tools/node/bin:$PATH node login.e2e.mjs
// The owner's bug: /account → /login → email → link in Gmail → Chrome → homepage, not signed in.
// Here: a scanner opens the link first, then the phone; the phone must still end up on /account.
import { webkit, devices, request } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';

const SHOTS = new URL('./shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const EMAIL = 'roy@example.test';
const stack = await startStack();
const browser = await webkit.launch();
const phone = { ...devices['iPhone 15'], userAgent: IPHONE_UA, ignoreHTTPSErrors: true };

try {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();

  console.log('sign in on the phone, with a mail scanner opening the link first');
  await page.goto(BASE + '/account');
  check('/account without a session goes to /login', new URL(page.url()).pathname === '/login');
  await hydrated(page);
  await page.fill('input[type=email]', EMAIL);
  await page.getByRole('button', { name: 'Send sign-in link' }).tap();
  await page.getByText('Check your inbox').waitFor();
  check('"Check your inbox" is shown', true);
  const link = await stack.lastLink(EMAIL);

  const scanner = await request.newContext({ ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (compatible; LinkScanner/1.0)' });
  const scan = await scanner.get(link, { maxRedirects: 0 });
  check('the scanner\'s GET gets the confirm page, no session', scan.status() === 200 && !(scan.headers()['set-cookie'] ?? '').includes('pg_session'));
  await scanner.get(link, { maxRedirects: 0 }); // and once more (preview + prefetch)

  await page.goto(link);
  const shown = await page.locator('#signin-email').textContent();
  check('the phone sees "Sign in as r***@example.test"', shown === 'r***@example.test', shown ?? '');
  check('confirm page: no sideways scrolling at phone width', await noSideScroll(page));
  const btn = page.locator('#signin-confirm');
  const box = await btn.boundingBox();
  check('the Sign in button is big enough to tap (≥ 44 px high)', !!box && box.height >= 44, String(box?.height));
  await page.screenshot({ path: SHOTS + 'login-confirm.png' });
  await btn.tap();
  await page.waitForURL(/\/account$/);
  check('tapping Sign in lands on /account', new URL(page.url()).pathname === '/account');
  await page.getByText(EMAIL).first().waitFor();
  check('/account shows the signed-in email (no bounce to /login)', true);
  const c = (await ctx.cookies()).find((x) => x.name === 'pg_session');
  check('pg_session is HttpOnly + Secure + SameSite=Lax', !!c && c.httpOnly && c.secure && c.sameSite === 'Lax');
  await page.screenshot({ path: SHOTS + 'login-account.png' });
  await page.reload();
  check('a reload stays on /account', new URL(page.url()).pathname === '/account');

  console.log('\nthe same link again, on another browser');
  const ctx2 = await browser.newContext(phone);
  const p2 = await ctx2.newPage();
  await p2.goto(link);
  check('a used link goes to /login (not the homepage)', new URL(p2.url()).pathname === '/login', p2.url());
  await p2.locator('#link-expired').waitFor();
  check('it says "This sign-in link has expired or was already used."', (await p2.locator('#link-expired').textContent())?.includes('This sign-in link has expired or was already used.') === true);
  check('the email field is right there', await p2.locator('input[type=email]').isVisible());
  check('/login: no sideways scrolling at phone width', await noSideScroll(p2));
  await p2.screenshot({ path: SHOTS + 'login-expired.png' });
  await hydrated(p2);
  await p2.fill('input[type=email]', EMAIL);
  await p2.getByRole('button', { name: 'Send sign-in link' }).tap();
  await p2.getByText('Check your inbox').waitFor();
  check('a new link can be asked for from that page', true);
  const fresh = await stack.lastLink(EMAIL, 2);
  check('the new link is a different one', fresh !== link);

  console.log('\nsign out');
  await page.getByRole('link', { name: 'Sign out' }).tap();
  await page.waitForURL((u) => new URL(u).pathname === '/');
  await page.goto(BASE + '/account');
  check('after signing out, /account goes to /login again', new URL(page.url()).pathname === '/login');
} catch (e) {
  check('no exception', false, String(e?.message ?? e).split('\n')[0]);
  for (const [i, pg] of browser.contexts().flatMap((c) => c.pages()).entries()) {
    await pg.screenshot({ path: SHOTS + `fail-${i}.png` }).catch(() => {});
    console.log('page', i, pg.url(), (await pg.locator('body').innerText().catch(() => '')).slice(0, 300).replace(/\n+/g, ' | '));
  }
  console.log(stack.log.text.split('\n').slice(-25).join('\n'));
} finally {
  await browser.close();
  stack.stop();
}
const { passed, failed } = result();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
