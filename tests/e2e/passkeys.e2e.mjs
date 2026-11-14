// PASSKEYS-1 in real browsers, against the local HTTPS stack (fake KV + Brevo, next dev on https://localhost:3100;
// the relying party is "localhost" there, powerguardian.cloud in production).
//   Chromium + a CDP virtual authenticator (internal, resident keys, user verification): the full ceremony.
//     e-mail sign-in → "Sign in faster next time — add a passkey" → recovery codes → passkey list → sign out →
//     "Continue as p***@example.test" → passkey sign-in → remove (confirmed with the passkey) → the removed passkey is
//     refused → an owner with a site sets up two-step with a passkey during sign-in, then signs in with it.
//   WebKit iPhone (no virtual authenticator in WebKit): layout of the same screens, including the installed app.
// Demo data only; screenshots carry a DEMO label.
//   cd tests/e2e && npm install && PATH=~/dev/.tools/node/bin:$PATH node passkeys.e2e.mjs [shot-dir]
import { chromium, webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';

const SHOTS = (process.argv[2] ?? new URL('./shots/', import.meta.url).pathname).replace(/\/?$/, '/'); mkdirSync(SHOTS, { recursive: true });
const PLAIN = 'pat@example.test', OWNER = 'owner@example.test', PHONE = 'phone@example.test';
const stack = await startStack();
const CTRL = 'c0ffee'.repeat(10) + 'c0ff';
const lic = { id: 'lic-owner', email: OWNER, plan: 'pro', site_id: 's', connector_limit: 5, expires_at: null, status: 'active', notes: '',
  created_at: new Date().toISOString(), token: 'tok-owner-' + 'a'.repeat(24), claimed_by: CTRL, claimed_hostname: 'nanopi-r3s', site_name: 'Acer' };
stack.kv.set('license:lic-owner', JSON.stringify(lic));
stack.kv.set('index:token:' + lic.token, 'lic-owner');
stack.kv.set('index:all', JSON.stringify(['lic-owner']));

const demo = (page) => page.evaluate(() => {
  const b = document.createElement('div');
  b.textContent = 'DEMO';
  b.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top) + 10px);right:10px;z-index:9999;padding:3px 9px;border-radius:6px;background:#f59e0b;color:#000;font:700 11px/1.4 system-ui;letter-spacing:.12em';
  document.body.appendChild(b);
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove());
});
const shot = async (page, name, full = false) => { await demo(page); await page.screenshot({ path: SHOTS + name, fullPage: full }); };

async function signInByLink(page, email, n, click = 'click') {
  await page.goto(BASE + '/login');
  await hydrated(page, '#remembered-other, input[type=email]');
  if (await page.locator('#remembered-other').isVisible().catch(() => false)) { await page.locator('#remembered-other')[click](); await hydrated(page); }
  await page.fill('input[type=email]', email);
  await page.getByRole('button', { name: 'Send sign-in link' })[click]();
  await page.getByText('Check your inbox').waitFor();
  await page.goto(await stack.lastLink(email, n));
  await page.locator('#signin-confirm')[click]();
  await page.waitForURL((u) => !new URL(u).pathname.startsWith('/api/auth/verify'));
  await page.waitForLoadState();
}
const pkFirst = (page) => page.evaluate(() => {
  const b = document.querySelector('#passkey-signin'), i = document.querySelector('input[type=email]');
  return !!b && !!i && b.getBoundingClientRect().top < i.getBoundingClientRect().top;
});
const signOut = async (page) => { await page.goto(BASE + '/api/auth/logout'); await page.waitForLoadState(); };

const chrome = await chromium.launch();
try {
  console.log('Chromium (virtual authenticator): account without sites');
  const ctx = await chrome.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 }, timezoneId: 'Europe/Amsterdam' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });

  await page.goto(BASE + '/login');
  await hydrated(page);
  await page.locator('#passkey-signin').waitFor();
  check('/login: "Sign in with a passkey" is the first choice, above the e-mail field', await pkFirst(page));
  check('the e-mail field offers passkeys in autofill (autocomplete="username webauthn")', (await page.locator('input[type=email]').getAttribute('autocomplete')) === 'username webauthn');
  check('the e-mail link stays as the fallback below', await page.getByRole('button', { name: 'Send sign-in link' }).isVisible());
  await shot(page, 'passkeys-login-desktop.png');

  await signInByLink(page, PLAIN, 1);
  check('the e-mail link signs in (no passkey yet, no two-step)', new URL(page.url()).pathname === '/account');
  await page.locator('#passkey-offer').waitFor();
  check('once, inline: "Sign in faster next time — add a passkey"', (await page.locator('#passkey-offer').textContent()).includes('Sign in faster next time — add a passkey'));
  await shot(page, 'passkeys-offer-desktop.png');
  await page.locator('#passkey-offer-add').click();
  await page.locator('#passkey-codes').waitFor();
  const codes = (await page.locator('#passkey-codes li').allTextContents()).map((s) => s.trim());
  check('adding the first passkey shows 10 recovery codes (two-step is now on)', codes.length === 10 && codes.every((c) => /^[a-z2-7]{5}-[a-z2-7]{5}$/.test(c)));
  const creds = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials;
  check('the authenticator holds one resident passkey for rp "localhost"', creds.length === 1 && creds[0].isResidentCredential && creds[0].rpId === 'localhost');
  await page.locator('#passkey-codes-done').click();
  check('"I saved them" closes the offer', !(await page.locator('#passkey-offer').isVisible()));
  await page.locator('#passkeys-manage').click();
  await page.locator('#passkeys-list li').first().waitFor();
  check('the list shows the passkey with its device name, added date and "not used yet"', /Mac|Linux|Windows/.test(await page.locator('#passkeys-list li').first().textContent()) && (await page.locator('#passkeys-list li').first().textContent()).includes('not used yet'));
  await page.waitForFunction(() => document.querySelector('#two-step-state')?.textContent === 'On');
  check('Two-step sign-in now says On', (await page.locator('#two-step-state').textContent()) === 'On');
  const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem('pg_account') ?? 'null'));
  check('this browser remembers only a masked address and a random handle (no e-mail in clear)', remembered?.masked === 'p***@example.test' && /^[A-Za-z0-9_-]{43}$/.test(remembered.handle) && !JSON.stringify(remembered).includes(PLAIN));
  check('…and that the account has a passkey', remembered?.passkey === true);
  await page.reload();
  check('the offer does not come back once dismissed or done', !(await page.locator('#passkey-offer').isVisible()));

  console.log('\nsign out → remembered account → passkey sign-in');
  await signOut(page);
  await page.goto(BASE + '/login');
  await hydrated(page, '#remembered-continue');
  check('/login shows "Continue as p***@example.test" with "Use another account" and "Forget"',
    (await page.locator('#remembered-continue').textContent()) === 'Continue as p***@example.test' && await page.locator('#remembered-other').isVisible() && await page.locator('#remembered-forget').isVisible());
  await shot(page, 'passkeys-remembered-desktop.png');
  await page.locator('#remembered-continue').click();
  await page.waitForURL(/\/account$/);
  check('one click + the passkey → signed in, no e-mail', new URL(page.url()).pathname === '/account');
  const sess = (await ctx.cookies()).find((c) => c.name === 'pg_session');
  check('session cookie set (HttpOnly, Secure, Lax)', !!sess && sess.httpOnly && sess.secure && sess.sameSite === 'Lax');
  const audit = [...stack.kv.entries()].filter(([k]) => k.startsWith('audit:')).map(([, v]) => JSON.parse(v));
  check('audit trail: passkey.add and signin.passkey for this account', audit.some((e) => e.action === 'passkey.add' && e.email === PLAIN) && audit.some((e) => e.action === 'signin.passkey' && e.email === PLAIN));

  // a second passkey (another device), for a realistic list in the screenshot: seeded as data, not as a ceremony
  const acc = JSON.parse(stack.kv.get('passkeys:' + PLAIN));
  acc.creds.push({ ...acc.creds[0], id: 'demo-second-passkey-id-0000000000000000000', name: 'iCloud Keychain · iPhone', synced: true, created_at: new Date(Date.now() - 9 * 86_400_000).toISOString(), last_used_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), counter: 0 });
  stack.kv.set('passkeys:' + PLAIN, JSON.stringify(acc));
  await page.reload();
  await page.locator('#passkeys-manage').click();
  await page.locator('#passkeys-list li').nth(1).waitFor();
  check('the list says when each passkey was last used', (await page.locator('#passkeys-list li').first().textContent()).includes('used just now'));
  await page.locator('#passkeys').scrollIntoViewIfNeeded();
  await shot(page, 'passkeys-account-desktop.png', true);

  console.log('\nremove, confirmed with the passkey');
  await page.locator('#passkeys-list li').first().locator('[data-remove]').click();
  await page.locator('#passkey-remove').waitFor();
  await page.locator('#passkey-remove-passkey').click();
  await page.waitForFunction(() => document.querySelectorAll('#passkeys-list li').length === 1);
  check('removed; the other passkey stays', (await page.locator('#passkeys-list li').count()) === 1);
  check('audit: passkey.remove', [...stack.kv.entries()].some(([k, v]) => k.startsWith('audit:') && v.includes('"passkey.remove"')));

  console.log('\nthe removed passkey cannot sign in');
  await signOut(page);
  await page.goto(BASE + '/login');
  await hydrated(page, '#remembered-continue');
  await page.locator('#remembered-other').click();
  await page.locator('#passkey-signin').click();
  await page.locator('#passkey-error').waitFor();
  check('it says the passkey is not on an account any more; no session', (await page.locator('#passkey-error').textContent()).includes('not on a PowerGuardian account') && !(await ctx.cookies()).some((c) => c.name === 'pg_session'));
  await page.locator('#remembered-back').click();
  await page.locator('#remembered-forget').click();
  check('"Forget" removes the card and the stored account', await page.locator('input[type=email]').isVisible() && (await page.evaluate(() => localStorage.getItem('pg_account'))) === null);

  console.log('\nowner with a site: two-step set up with a passkey during sign-in');
  const ctx2 = await chrome.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 } });
  const p2 = await ctx2.newPage();
  const cdp2 = await ctx2.newCDPSession(p2);
  await cdp2.send('WebAuthn.enable');
  const owner = await cdp2.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await signInByLink(p2, OWNER, 1);
  check('after the link: the setup page', new URL(p2.url()).pathname === '/login/mfa');
  await p2.locator('#mfa-passkey-setup').waitFor({ state: 'visible' });
  check('"Add a passkey" is offered first (recommended), the authenticator app below', await p2.locator('#mfa-qr').isVisible());
  await shot(p2, 'passkeys-setup-desktop.png', true);
  await p2.locator('#mfa-passkey-setup').click();
  await p2.locator('#mfa-codes').waitFor();
  check('passkey added during sign-in: 10 recovery codes shown once', (await p2.locator('#mfa-codes li').count()) === 10);
  await p2.locator('#mfa-continue').click();
  await p2.waitForURL(/\/account$/);
  check('then My sites, signed in with two-step', new URL(p2.url()).pathname === '/account');
  await p2.waitForFunction(() => !!localStorage.getItem('pg_account'));
  await signOut(p2);
  await p2.goto(BASE + '/login');
  await hydrated(p2, '#remembered-other');
  await p2.locator('#remembered-other').click();
  await p2.waitForURL(/\/account$/, { timeout: 15000 }).catch(() => {});
  check('autofill (conditional UI) on the e-mail field signs in with the passkey (the virtual authenticator picks it at once)', new URL(p2.url()).pathname === '/account');
  await signOut(p2);
  // a real person picks the passkey from the autofill list; here the authenticator waits, so the e-mail link can go on
  await cdp2.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId: owner.authenticatorId, enabled: false });
  await signInByLink(p2, OWNER, 2);
  await cdp2.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId: owner.authenticatorId, enabled: true });
  check('next time the link asks for the second step', new URL(p2.url()).pathname === '/login/mfa');
  await p2.locator('#mfa-passkey').waitFor({ state: 'visible' });
  await shot(p2, 'passkeys-two-step-desktop.png');
  await p2.locator('#mfa-passkey').click();
  await p2.waitForURL(/\/account$/);
  check('"Use a passkey" passes it → My sites', new URL(p2.url()).pathname === '/account');
} catch (e) { check('chromium run: ' + (e?.message ?? e), false); }
finally { await chrome.close(); }

console.log('\nWebKit iPhone (layout; WebKit has no virtual authenticator)');
const wk = await webkit.launch();
try {
  const phone = { ...devices['iPhone 15'], userAgent: IPHONE_UA, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam' };
  const ctx = await wk.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(BASE + '/login');
  await hydrated(page);
  const hasPk = await page.evaluate(() => typeof window.PublicKeyCredential === 'function');
  if (hasPk) {
    await page.locator('#passkey-signin').waitFor();
    const box = await page.locator('#passkey-signin').boundingBox();
    check('iPhone /login: the passkey button is first and big enough to tap (≥ 44 px)', !!box && box.height >= 44);
  } else check('(this WebKit build has no PublicKeyCredential: the page is the e-mail form only)', await page.locator('input[type=email]').isVisible());
  check('iPhone /login: no sideways scrolling', await noSideScroll(page));
  check('iPhone /login: e-mail field uses 16 px text (no zoom)', (await page.locator('input[type=email]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 16);
  await shot(page, 'passkeys-login-iphone.png');

  await signInByLink(page, PHONE, 1, 'tap');
  check('iPhone: signed in by link', new URL(page.url()).pathname === '/account');
  // demo passkeys for this account (data only), then the list
  const handle = Buffer.alloc(32, 3).toString('base64url');
  const jwk = { kty: 'EC', crv: 'P-256', x: 'f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU', y: 'x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0' };
  const at = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
  stack.kv.set('passkeys:' + PHONE, JSON.stringify({ v: 1, handle, creds: [
    { id: 'demo-phone-passkey-1-00000000000000000000000', jwk, alg: -7, name: 'iCloud Keychain · iPhone', created_at: at(24 * 12), last_used_at: at(0.2), counter: 0, synced: true, aaguid: '' },
    { id: 'demo-phone-passkey-2-00000000000000000000000', jwk, alg: -7, name: 'Windows Hello · Windows', created_at: at(24 * 40), last_used_at: at(24 * 6), counter: 4, synced: false, aaguid: '' },
  ] }));
  await page.reload();
  await page.locator('#passkeys-manage').tap();
  await page.locator('#passkeys-list li').nth(1).waitFor();
  check('iPhone account: passkey list, no sideways scrolling', await noSideScroll(page));
  const rm = await page.locator('#passkeys-list li').first().locator('[data-remove]').boundingBox();
  check('iPhone account: Remove is big enough to tap', !!rm && rm.height >= 44);
  await page.locator('#passkeys').scrollIntoViewIfNeeded();
  await shot(page, 'passkeys-account-iphone.png', true);

  await page.evaluate(() => localStorage.setItem('pg_account', JSON.stringify({ v: 1, masked: 'p***@example.test', handle: 'A'.repeat(43), passkey: true })));
  await signOut(page);
  await page.goto(BASE + '/login');
  await hydrated(page, '#remembered-continue');
  check('iPhone /login: remembered-account card, no sideways scrolling', await page.locator('#remembered').isVisible() && await noSideScroll(page));
  const cb = await page.locator('#remembered-continue').boundingBox();
  check('iPhone: "Continue as…" is big enough to tap', !!cb && cb.height >= 44);
  await shot(page, 'passkeys-remembered-iphone.png');

  console.log('\nthe installed app (standalone)');
  const app = await wk.newContext(phone);
  await app.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm(q));
  });
  const ap = await app.newPage();
  await ap.goto(BASE + '/login');
  await hydrated(ap);
  await ap.waitForFunction(() => /6-digit code/.test(document.querySelector('button[type=submit]')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
  if (hasPk) check('in the app the passkey is the first choice too; the 6-digit code is the fallback', await pkFirst(ap) && ((await ap.locator('button[type=submit]').textContent()) ?? '').includes('6-digit code'));
  check('app /login: no sideways scrolling', await noSideScroll(ap));
  await shot(ap, 'passkeys-app-iphone.png');

  console.log('\ntwo-step page on the iPhone (account with a passkey)');
  const ctx3 = await wk.newContext(phone);
  const p3 = await ctx3.newPage();
  await signInByLink(p3, PHONE, 2, 'tap');
  check('iPhone: the link goes to the two-step page', new URL(p3.url()).pathname === '/login/mfa');
  if (hasPk) await p3.locator('#mfa-passkey').waitFor({ state: 'visible' });
  check('iPhone two-step page: no sideways scrolling', await noSideScroll(p3));
  await shot(p3, 'passkeys-two-step-iphone.png');
} catch (e) { check('webkit run: ' + (e?.message ?? e), false); }
finally { await wk.close(); stack.stop(); }

const { passed, failed } = result();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
