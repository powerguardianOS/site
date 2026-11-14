// CLOUD-MFA in a phone browser (WebKit = Safari and Chrome on iPhone).
//   cd tests/e2e && npm install && PATH=~/dev/.tools/node/bin:$PATH node mfa.e2e.mjs
// An owner with a site signs in: two-step setup inline (QR, "Add to authenticator app", key, code), recovery codes once,
// the SSO statement for their controller carries mfa:true, the account card makes new codes / turns it off, a recovery
// code signs in once. An account without sites goes straight in and can set it up from the card.
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';
import { totp } from '../../scripts/cloud-dev.mjs';

const SHOTS = new URL('./shots/', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const OWNER = 'owner@example.test', PLAIN = 'plain@example.test';
const CTRL = 'c0ffee'.repeat(10) + 'c0ff', NONCE = 'ab'.repeat(24), RET = 'https://192.168.10.235/api/auth/sso/callback';
const stack = await startStack();
const lic = { id: 'lic-owner', email: OWNER, plan: 'pro', site_id: 's', connector_limit: 5, expires_at: null, status: 'active', notes: '',
  created_at: new Date().toISOString(), token: 'tok-owner-' + 'a'.repeat(24), claimed_by: CTRL, claimed_hostname: 'nanopi-r3s', site_name: 'Acer' };
stack.kv.set('license:lic-owner', JSON.stringify(lic));
stack.kv.set('index:token:' + lic.token, 'lic-owner');
stack.kv.set('index:all', JSON.stringify(['lic-owner']));

const browser = await webkit.launch();
const phone = { ...devices['iPhone 15'], userAgent: IPHONE_UA, ignoreHTTPSErrors: true };
const keyOf = async (page, sel) => (await page.locator(sel).textContent()).replace(/\s/g, '');

async function signInByLink(page, email, n) {
  await page.goto(BASE + '/login');
  await hydrated(page);
  await page.fill('input[type=email]', email);
  await page.getByRole('button', { name: 'Send sign-in link' }).tap();
  await page.getByText('Check your inbox').waitFor();
  await page.goto(await stack.lastLink(email, n));
  await page.locator('#signin-confirm').tap();
  await page.waitForURL((u) => !new URL(u).pathname.startsWith('/api/auth/verify'));
  await page.waitForLoadState();
}

try {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();

  console.log('owner with a site: two-step setup is part of the sign-in');
  await signInByLink(page, OWNER, 1);
  check('after the link: the setup page, not the account', new URL(page.url()).pathname === '/login/mfa');
  check('no session yet', !(await ctx.cookies()).some((c) => c.name === 'pg_session'));
  check('QR code is shown', await page.locator('#mfa-qr svg').isVisible());
  const add = page.locator('#mfa-add-app');
  check('"Add to authenticator app" button is shown on the phone and opens otpauth://', await add.isVisible() && (await add.getAttribute('href')).startsWith('otpauth://totp/PowerGuardian'));
  const input = page.locator('#mfa-code');
  check('code field: inputmode=numeric, autocomplete=one-time-code', (await input.getAttribute('inputmode')) === 'numeric' && (await input.getAttribute('autocomplete')) === 'one-time-code');
  check('setup page: no sideways scrolling', await noSideScroll(page));
  await page.screenshot({ path: SHOTS + 'mfa-setup.png', fullPage: true });
  const key = await keyOf(page, '#mfa-key');
  await input.fill('000000');
  await page.locator('#mfa-submit').tap();
  await page.locator('#mfa-error').waitFor();
  check('a wrong code says so on the same page', (await page.locator('#mfa-error').textContent()).includes('That code did not work'));
  await page.locator('#mfa-code').fill(totp(key).replace(/(\d{3})/, '$1 ')); // as pasted from some apps
  await page.locator('#mfa-submit').tap();
  await page.locator('#mfa-codes').waitFor();
  const codes = (await page.locator('#mfa-codes li').allTextContents()).map((s) => s.trim());
  check('10 recovery codes are shown once', codes.length === 10 && codes.every((c) => /^[a-z2-7]{5}-[a-z2-7]{5}$/.test(c)));
  check('recovery page: no sideways scrolling', await noSideScroll(page));
  await page.screenshot({ path: SHOTS + 'mfa-recovery-codes.png', fullPage: true });
  await page.locator('#mfa-continue').tap();
  await page.waitForURL(/\/account$/);
  check('then on to /account', true);
  await page.locator('#two-step').scrollIntoViewIfNeeded();
  check('the card says On with 10 recovery codes left', (await page.locator('#two-step-state').textContent()) === 'On' && (await page.locator('#two-step').textContent()).includes('10 recovery codes left'));
  check('account page: no sideways scrolling', await noSideScroll(page));
  await page.locator('#two-step').screenshot({ path: SHOTS + 'mfa-card-on.png' });

  console.log('\nsign in to the controller with PowerGuardian Cloud');
  let landed = '';
  await page.route('https://192.168.10.235/**', (route) => { landed = route.request().url(); route.fulfill({ status: 200, contentType: 'text/html', body: '<p>controller</p>' }); });
  await page.goto(`${BASE}/sso/authorize?` + new URLSearchParams({ controller: CTRL, nonce: NONCE, return: RET }));
  check('authorize page: "Sign in to Acer"', (await page.locator('h1').textContent()).includes('Sign in to Acer'));
  const ssoResp = page.waitForResponse((r) => r.url().endsWith('/sso/authorize') && r.request().method() === 'POST').catch(() => null);
  await page.locator('#sso-continue').tap();
  const sr = await ssoResp;
  if (sr) console.log('   (authorize POST answered', sr.status(), 'Origin sent:', JSON.stringify(sr.request().headers()['origin'] ?? null) + ')');
  for (let i = 0; i < 50 && !landed; i++) await page.waitForTimeout(100);
  const assertion = decodeURIComponent(landed.split('assertion=')[1] ?? '');
  const body = assertion ? JSON.parse(Buffer.from(assertion.slice('pgsso1.'.length, assertion.lastIndexOf('.')), 'base64url').toString()) : null;
  check('Continue goes back to the controller with a statement', !!body && body.controller_id === CTRL, landed ? '' : (await page.locator('body').innerText()).replace(/\n+/g, ' | '));
  check('the statement says mfa: true (this session passed two-step)', body?.mfa === true);

  console.log('\naccount card: new recovery codes');
  await page.goto(BASE + '/account');
  await hydrated(page, '#two-step-new-codes');
  await page.locator('#two-step-new-codes').tap();
  await page.locator('#two-step-code').fill(totp(key, 1)); // the next code: each code works once
  await page.locator('#two-step-go').tap();
  await page.locator('#two-step-codes').waitFor();
  const fresh = (await page.locator('#two-step-codes li').allTextContents()).map((s) => s.trim());
  check('10 new recovery codes, inline in the card', fresh.length === 10 && !fresh.includes(codes[0]));
  await page.locator('#two-step').screenshot({ path: SHOTS + 'mfa-card-codes.png' });
  await page.locator('#two-step-done').tap();

  console.log('\nsign in again with a recovery code');
  await page.getByRole('link', { name: 'Sign out' }).tap();
  await page.waitForURL((u) => new URL(u).pathname === '/');
  await signInByLink(page, OWNER, 2);
  check('the two-step page asks for the code', (await page.locator('h1').textContent()) === 'Two-step sign-in' && await page.locator('#mfa-code').isVisible());
  await page.screenshot({ path: SHOTS + 'mfa-verify.png' });
  await page.getByText('Lost your phone? Use a recovery code').tap();
  await page.locator('#mfa-recovery').fill(codes[0]);
  await page.locator('#mfa-recovery-submit').tap();
  await page.locator('#mfa-error').waitFor();
  check('an old recovery code (replaced) does not work', await page.locator('#mfa-error').isVisible());
  await page.getByText('Lost your phone? Use a recovery code').tap();
  await page.locator('#mfa-recovery').fill(fresh[0]);
  await page.locator('#mfa-recovery-submit').tap();
  await page.locator('#mfa-left').waitFor();
  check('a new recovery code signs in, 9 left', (await page.locator('#mfa-left').textContent()) === '9');
  await page.locator('#mfa-continue').tap();
  await page.waitForURL(/\/account$/);

  console.log('\naccount card: turn off');
  await hydrated(page, '#two-step-remove');
  await page.locator('#two-step-remove').tap();
  check('turning off explains it comes back for accounts with sites', (await page.locator('#two-step').textContent()).includes('set it up again at your next sign-in'));
  await page.locator('#two-step-code').fill(fresh[1]);
  await page.locator('#two-step-go').tap();
  await page.locator('#two-step-state', { hasText: 'Off' }).waitFor();
  check('the card says Off', true);
  await page.locator('#two-step').screenshot({ path: SHOTS + 'mfa-card-off-required.png' });

  console.log('\naccount without sites: straight in, optional setup from the card');
  const ctx2 = await browser.newContext(phone);
  const p2 = await ctx2.newPage();
  await signInByLink(p2, PLAIN, 1);
  check('no two-step page: straight to /account', new URL(p2.url()).pathname === '/account');
  await hydrated(p2, '#two-step-setup');
  await p2.locator('#two-step-setup').tap();
  await p2.locator('#two-step-key').waitFor();
  check('setup inline: QR, "Add to authenticator app" (phone) and key', await p2.locator('#two-step svg').isVisible() && await p2.locator('#two-step-add-app').isVisible());
  check('card setup: no sideways scrolling', await noSideScroll(p2));
  await p2.locator('#two-step').screenshot({ path: SHOTS + 'mfa-card-setup.png' });
  await p2.locator('#two-step-code').fill(totp(await keyOf(p2, '#two-step-key')));
  await p2.locator('#two-step-confirm').tap();
  await p2.locator('#two-step-codes').waitFor();
  check('turned on from the card: 10 recovery codes shown', (await p2.locator('#two-step-codes li').count()) === 10);
  await p2.locator('#two-step-done').tap();
  check('the card says On', (await p2.locator('#two-step-state').textContent()) === 'On');
} catch (e) {
  check('no exception', false, String(e?.message ?? e).split('\n')[0]);
  for (const [i, pg] of browser.contexts().flatMap((c) => c.pages()).entries()) {
    await pg.screenshot({ path: SHOTS + `fail-mfa-${i}.png`, fullPage: true }).catch(() => {});
    console.log('page', i, pg.url(), (await pg.locator('body').innerText().catch(() => '')).slice(0, 400).replace(/\n+/g, ' | '));
  }
  console.log(stack.log.text.split('\n').filter((l) => /error|warn/i.test(l)).slice(-15).join('\n'));
} finally {
  await browser.close();
  stack.stop();
}
const { passed, failed } = result();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
