// PASSKEYS-1 in real browsers, against the local HTTPS stack (fake KV + Brevo, next dev on https://localhost:3100;
// the relying party is "localhost" there, powerguardian.cloud in production).
//   Chromium + a CDP virtual authenticator (internal, resident keys, user verification): the full ceremony.
//     /login has ONE button (B2: no passkey button, no account card) → e-mail sign-in → "Passkeys · Add" (the only place;
//     no banner) → recovery codes → passkey list → sign out → autofill signs in with the passkey → the typed address of
//     this device says Continue and signs in with the passkey (no mail) → remove (confirmed with the passkey) → the
//     removed passkey is refused and the link goes out instead → an owner with a site sets up two-step with a passkey
//     during sign-in, then signs in with it.
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

// LOGIN-2: the link opened in a new tab of the same browser signs in there; the tab that asked follows by itself.
async function signInByLink(page, email, n, click = 'click') {
  await page.goto(BASE + '/login');
  await hydrated(page);
  await page.fill('input[type=email]', email);
  await page.getByRole('button', { name: 'Send sign-in link' })[click]();
  await page.getByText('Check your inbox').waitFor();
  const tab = await page.context().newPage();
  await tab.goto(await stack.lastLink(email, n));
  await page.waitForURL((u) => new URL(u).pathname !== '/login', { timeout: 15000 });
  await page.waitForLoadState();
  await tab.close();
}
// B2: one way in on /login — the e-mail field and one button; no passkey button, no account card.
const oneButton = async (page) => (await page.locator('main button, form button').count()) === 1
  && (await page.locator('#passkey-signin, #remembered').count()) === 0;
const hints = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pg_pk') ?? '[]'));
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
  await page.waitForFunction(() => document.querySelector('input[type=email]')?.getAttribute('autocomplete') === 'username webauthn');
  check('the e-mail field offers passkeys in autofill (autocomplete="username webauthn")', (await page.locator('input[type=email]').getAttribute('autocomplete')) === 'username webauthn');
  check('/login: one button ("Send sign-in link"), no passkey button, no account card', await oneButton(page) && await page.getByRole('button', { name: 'Send sign-in link' }).isVisible());
  await shot(page, 'passkeys-login-desktop.png');

  await signInByLink(page, PLAIN, 1);
  check('the e-mail link signs in (no passkey yet, no two-step)', new URL(page.url()).pathname === '/account');
  await hydrated(page, '#passkeys-manage');
  check('no "add a passkey" banner: the quiet "Passkeys: None · Add" line is the single place', (await page.locator('#passkey-offer').count()) === 0
    && (await page.locator('#passkeys').innerText()).replace(/\s+/g, ' ').trim() === 'Passkeys: None · Add');
  await page.locator('#passkeys-manage').click();
  await page.locator('#passkey-add').click();
  // B2: one inline step first (two-step off): the code mailed to the account's own address
  await page.locator('#step-up-code').waitFor();
  check('"We sent a code to p***@example.test. Enter it to add a passkey." inline, no dialog', (await page.locator('#step-up-text').innerText()) === 'We sent a code to p***@example.test. Enter it to add a passkey.');
  await shot(page, 'passkeys-step-up-desktop.png');
  await page.locator('#step-up-code').fill(stack.mails.filter((m) => m.to === PLAIN).at(-1).text.match(/\b(\d{6})\b/)[1]);
  await page.locator('#step-up-go').click();
  await page.locator('#passkey-codes').waitFor();
  const codes = (await page.locator('#passkey-codes li').allTextContents()).map((s) => s.trim());
  check('the owner gets "A passkey was added" by mail', stack.mails.filter((m) => m.to === PLAIN).at(-1)?.subject === 'A passkey was added to your PowerGuardian account');
  check('adding the first passkey shows 10 recovery codes (two-step is now on)', codes.length === 10 && codes.every((c) => /^[a-z2-7]{5}-[a-z2-7]{5}$/.test(c)));
  const creds = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials;
  check('the authenticator holds one resident passkey for rp "localhost"', creds.length === 1 && creds[0].isResidentCredential && creds[0].rpId === 'localhost');
  await page.locator('#passkey-codes-done').click();
  await page.locator('#passkeys-list li').first().waitFor();
  check('"I saved them" goes back to the list', (await page.locator('#passkey-codes').count()) === 0);
  check('the list shows the passkey with its device name, added date and "not used yet"', /Mac|Linux|Windows/.test(await page.locator('#passkeys-list li').first().textContent()) && (await page.locator('#passkeys-list li').first().textContent()).includes('not used yet'));
  await page.waitForFunction(() => document.querySelector('#two-step-state')?.textContent === 'On');
  check('Two-step sign-in now says On', (await page.locator('#two-step-state').textContent()) === 'On');
  const h = await hints(page);
  check('this device keeps one hash for /login (no e-mail stored)', h.length === 1 && /^[0-9a-f]{64}$/.test(h[0]) && !JSON.stringify(h).includes('pat'));

  console.log('\nsign out → autofill → signed in with the passkey');
  const mailsBefore = stack.mails.length;
  await signOut(page);
  await page.goto(BASE + '/login');
  await page.waitForURL(/\/account$/, { timeout: 15000 }).catch(() => {});
  check('autofill (conditional UI) on the e-mail field signs in with the passkey (the virtual authenticator picks it at once)', new URL(page.url()).pathname === '/account');

  console.log('\nthe typed address of this device: Continue → the passkey, no mail');
  await signOut(page);
  await cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId, enabled: false }); // a person ignores the autofill list
  await page.goto(BASE + '/login');
  await hydrated(page);
  await page.fill('input[type=email]', PLAIN);
  await page.getByRole('button', { name: 'Continue' }).waitFor();
  check('the button says Continue for an address this device used a passkey for; still one button', await oneButton(page));
  await shot(page, 'passkeys-login-continue-desktop.png');
  await page.fill('input[type=email]', 'someone@else.test');
  check('…and "Send sign-in link" for any other address', await page.getByRole('button', { name: 'Send sign-in link' }).isVisible());
  await page.fill('input[type=email]', PLAIN);
  await cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId, enabled: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/account$/, { timeout: 15000 }).catch(() => {});
  check('Continue + the passkey → signed in, no e-mail sent at all', new URL(page.url()).pathname === '/account' && stack.mails.length === mailsBefore);
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
  await hydrated(page);
  await page.getByText('That passkey did not work').waitFor({ timeout: 15000 }).catch(() => {});
  check('autofill with the removed passkey → refused, a quiet line, no session', await page.getByText('That passkey did not work').isVisible() && !(await ctx.cookies()).some((c) => c.name === 'pg_session'));
  const before2 = stack.mails.filter((m) => m.to === PLAIN).length;
  await page.fill('input[type=email]', PLAIN);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Check your inbox').waitFor();
  check('Continue → the passkey is refused → the sign-in link goes out instead', stack.mails.filter((m) => m.to === PLAIN).length === before2 + 1);
  check('…and this device stops offering a passkey for that address', (await hints(page)).length === 0);

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
  check('the two-step page kept the hint for /login', (await hints(p2)).length === 1);
  await signOut(p2);
  await p2.goto(BASE + '/login');
  await p2.waitForURL(/\/account$/, { timeout: 15000 }).catch(() => {});
  check('autofill (conditional UI) on the e-mail field signs in with the passkey (the virtual authenticator picks it at once)', new URL(p2.url()).pathname === '/account');
  await signOut(p2);
  // a real person picks the passkey from the autofill list; here the authenticator waits, so the e-mail link can go on
  await cdp2.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId: owner.authenticatorId, enabled: false });
  await p2.evaluate(() => localStorage.removeItem('pg_pk')); // as on a device that never used the passkey for this address
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
  check('iPhone /login: one button, no passkey button or account card' + (hasPk ? '' : ' (this WebKit build has no PublicKeyCredential)'), await oneButton(page));
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

  if (hasPk) {
    await page.evaluate(async (e) => {
      const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pg passkey hint|' + e));
      localStorage.setItem('pg_pk', JSON.stringify([[...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('')]));
    }, PHONE);
    await signOut(page);
    await page.goto(BASE + '/login');
    await hydrated(page);
    await page.fill('input[type=email]', PHONE);
    await page.getByRole('button', { name: 'Continue' }).waitFor();
    const cb = await page.getByRole('button', { name: 'Continue' }).boundingBox();
    check('iPhone /login, address with a passkey on this device: one Continue button, big enough to tap, no sideways scrolling', await oneButton(page) && !!cb && cb.height >= 44 && await noSideScroll(page));
    await shot(page, 'passkeys-login-continue-iphone.png');
  }

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
  check('in the app: the same one button (the passkey via autofill, the 6-digit code comes with the mail)', await oneButton(ap));
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
