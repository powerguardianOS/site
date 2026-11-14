// LOGIN-1 + LOGIN-2 in a phone browser (WebKit = Safari and Chrome on iPhone).
//   cd tests/e2e && npm install && PATH=~/dev/.tools/node/bin:$PATH node login.e2e.mjs
// The owner's bug (LOGIN-1): /account → /login → email → link in Gmail → Chrome → homepage, not signed in.
// Here: a scanner opens the link first (it must change nothing), then the phone opens it in the same browser: signed in
// at once (LOGIN-2, no button), and the "Check your inbox" tab goes on to /account by itself. Another device gets the
// "Sign in" button. A browser gets no code (the installed app does: tests/e2e/pwa.e2e.mjs).
import { webkit, devices, request } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';

const SHOTS = new URL('./shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const EMAIL = 'roy@example.test';
const stack = await startStack();
const browser = await webkit.launch();
const phone = { ...devices['iPhone 15'], userAgent: IPHONE_UA, ignoreHTTPSErrors: true };
const codeOf = (to) => stack.mails.filter((m) => m.to === to).at(-1)?.text.match(/\b(\d{6})\b/)?.[1] ?? '';

async function askOn(page, email) {
  await page.goto(BASE + '/login');
  await hydrated(page);
  await page.fill('input[type=email]', email);
  await page.getByRole('button', { name: 'Send sign-in link' }).tap();
  await page.getByText('Check your inbox').waitFor();
}

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
  check('in a browser: a magic link only, no code field', await page.locator('#signin-code').count() === 0);
  check('"Check your inbox": no sideways scrolling', await noSideScroll(page));
  await page.screenshot({ path: SHOTS + 'login-inbox.png' });
  const link = await stack.lastLink(EMAIL);
  const mail = stack.mails.filter((m) => m.to === EMAIL).at(-1);
  check('the mail has the link and the logo (PNG, absolute URL), no code', !/\b\d{6}\b/.test(mail.text.replace(link, '')) && /src="https:\/\/powerguardian\.cloud\/icons\/[\w-]+\.png"/.test(mail.html ?? '') && mail.text.includes(link));

  const scanner = await request.newContext({ ignoreHTTPSErrors: true, userAgent: 'Mozilla/5.0 (compatible; LinkScanner/1.0)' });
  const scan = await scanner.get(link, { maxRedirects: 0 });
  const scanHtml = await scan.text();
  check('the scanner\'s GET gets the "Sign in" button page, no session', scan.status() === 200 && scanHtml.includes('id="signin-confirm">Sign in</button>') && !(scan.headers()['set-cookie'] ?? '').includes('pg_session'));
  await scanner.get(link, { maxRedirects: 0 }); // and once more (preview + prefetch)

  const tab = await ctx.newPage(); // the mail app opens the link in a new tab of the same browser
  await tab.goto(link);
  await tab.locator('#signin-done').waitFor();
  check('the link in the same browser: "You\'re signed in. You can close this page." — no button', (await tab.locator('h1').textContent()) === "You're signed in" && (await tab.locator('#signin-confirm').count()) === 0);
  check('…with a quiet "Go to My sites" link', (await tab.locator('#signin-my-sites').getAttribute('href')) === '/account');
  check('signed-in page: no sideways scrolling', await noSideScroll(tab));
  await tab.screenshot({ path: SHOTS + 'login-signed-in.png' });
  await page.waitForURL(/\/account$/, { timeout: 10000 });
  check('the "Check your inbox" tab went on to /account by itself', new URL(page.url()).pathname === '/account');
  await page.getByText(EMAIL).first().waitFor();
  check('/account shows the signed-in email (no bounce to /login)', true);
  const c = (await ctx.cookies()).find((x) => x.name === 'pg_session');
  check('pg_session is HttpOnly + Secure + SameSite=Lax', !!c && c.httpOnly && c.secure && c.sameSite === 'Lax');
  await page.screenshot({ path: SHOTS + 'login-account.png' });
  await page.reload();
  check('a reload stays on /account', new URL(page.url()).pathname === '/account');
  await tab.close();

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

  console.log('\nthe link on another device: the button');
  const asker = await (await browser.newContext(phone)).newPage();
  await askOn(asker, 'other@example.test');
  const l3 = await stack.lastLink('other@example.test');
  const dev = await (await browser.newContext(phone)).newPage();
  await dev.goto(l3);
  const btn = dev.locator('#signin-confirm');
  check('another device sees one "Sign in" button, no code talk', (await btn.textContent()) === 'Sign in' && await dev.locator('#signin-code-hint').count() === 0);
  const box = await btn.boundingBox();
  check('the button is big enough to tap (≥ 44 px high)', !!box && box.height >= 44, String(box?.height));
  check('confirm page: no sideways scrolling at phone width', await noSideScroll(dev));
  await dev.screenshot({ path: SHOTS + 'login-confirm.png' });
  await btn.tap();
  await dev.waitForURL(/\/account$/);
  check('tapping it signs that device in', new URL(dev.url()).pathname === '/account');
  await asker.locator('#signin-dead').waitFor({ timeout: 10000 });
  check('the browser that asked now says the sign-in expired, with "Request a new link"', await asker.locator('#signin-new-link').isVisible());

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
