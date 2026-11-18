// FEEDBACK-1: the controller API (license token), the account API, /feedback signed out and in, isolation between
// accounts, the admin section (tabs, reply, merge, fixed in, reject), HTML in feedback shown as text everywhere, and
// iPhone width for /feedback and the admin section. Demo data only; screenshots carry a DEMO label.
//   cd tests/e2e && npm install && node feedback.e2e.mjs [shot-dir]
import { webkit, devices, request } from 'playwright';
import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { startStack, check, result, hydrated, noSideScroll, BASE, IPHONE_UA } from './stack.mjs';
import { ADMIN } from '../../scripts/cloud-dev.mjs';

const SHOTS = (process.argv[2] ?? new URL('./shots/', import.meta.url).pathname).replace(/\/?$/, '/'); mkdirSync(SHOTS, { recursive: true });
const stack = await startStack();
const DAY = 86_400_000, now = Date.now();
const ANNA = 'anna@demo.example', BOB = 'bob@demo.example';
const mkLic = (id, email) => ({ id, email, plan: 'pro', site_id: 'default-site', site_name: 'Head office', connector_limit: 5, expires_at: null,
  status: 'active', notes: '', created_at: new Date(now - 40 * DAY).toISOString(), token: `tok-${id}-` + randomBytes(12).toString('hex') });
const LA = mkLic('lic-anna', ANNA), LB = mkLic('lic-bob', BOB), LC = mkLic('lic-flood', 'carl@demo.example');
for (const l of [LA, LB, LC]) { stack.kv.set('license:' + l.id, JSON.stringify(l)); stack.kv.set('index:token:' + l.token, l.id); }
stack.kv.set('index:all', JSON.stringify([LA.id, LB.id, LC.id]));

const sid = (email) => {
  const s = randomBytes(32).toString('hex');
  stack.kv.set('session:' + s, JSON.stringify({ email, expires: now + DAY, mfa: true }));
  return s;
};
const cookie = (email) => ({ name: 'pg_session', value: sid(email), domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
const demo = (page) => page.evaluate(() => {
  const b = document.createElement('div');
  b.textContent = 'DEMO';
  b.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top) + 10px);right:10px;z-index:9999;padding:3px 9px;border-radius:6px;background:#f59e0b;color:#000;font:700 11px/1.4 system-ui;letter-spacing:.12em';
  document.body.appendChild(b);
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove());
});
const XSS = '<img src=x onerror="window.__xss=1"><b>bold</b> NAS did not wake up';
const XSS_REPLY = '<script>window.__xss=2</script><i>Which</i> NAS model?';
const ctlApi = (token) => request.newContext({ ignoreHTTPSErrors: true, extraHTTPHeaders: token ? { authorization: 'Bearer ' + token } : {} });
const acctApi = (email) => request.newContext({ ignoreHTTPSErrors: true, extraHTTPHeaders: email ? { cookie: 'pg_session=' + sid(email), origin: BASE } : { origin: BASE } });
const IPHONE = { ...devices['iPhone 15'], userAgent: IPHONE_UA };

// next dev compiles a route on its first request and may drop that connection: ask each route once first.
async function warm() {
  const ctx = await request.newContext({ ignoreHTTPSErrors: true });
  for (const p of ['/api/cloud/feedback', '/api/account/feedback', '/api/admin/feedback', '/feedback', '/account', '/admin/feedback']) {
    for (let i = 0; i < 5; i++) { try { await ctx.get(BASE + p, { maxRedirects: 0, timeout: 120_000 }); break; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
  }
  // and until it answers three times in a row (a first compile can restart the dev server)
  for (let ok = 0, i = 0; ok < 3 && i < 60; i++) {
    try { await ctx.get(BASE + '/api/cloud/feedback', { timeout: 30_000 }); ok++; } catch { ok = 0; await new Promise((r) => setTimeout(r, 1000)); }
  }
  await ctx.dispose();
}

const browser = await webkit.launch();
try {
  await warm();
  console.log('controller API');
  const ca = await ctlApi(LA.token), cb = await ctlApi(LB.token);
  let r = await ca.post(BASE + '/api/cloud/feedback', { data: { kind: 'bug', text: XSS, version: '0.1.120', report_id: 'PGR-ABCD-EFGH' } });
  const annaBug = (await r.json()).id;
  check('controller POST with its license token → 200 {id}', r.status() === 200 && /^[0-9a-f]{16}$/.test(annaBug));
  r = await ca.get(BASE + '/api/cloud/feedback');
  let items = (await r.json()).items;
  check('controller GET → its own item, status new, no replies', r.status() === 200 && items.length === 1 && items[0].id === annaBug && items[0].status === 'new' && items[0].text === XSS);
  const bad = await ctlApi('tok-nope-' + 'c'.repeat(24));
  check('a bad token → 401 (POST and GET)', (await bad.post(BASE + '/api/cloud/feedback', { data: { kind: 'bug', text: 'x', version: '1' } })).status() === 401 && (await bad.get(BASE + '/api/cloud/feedback')).status() === 401);
  const none = await ctlApi(null);
  check('no token → 401', (await none.get(BASE + '/api/cloud/feedback')).status() === 401);
  r = await ca.post(BASE + '/api/cloud/feedback', { data: { kind: 'complaint', text: 'x', version: '1' } });
  check('an unknown kind → 400 (kind)', r.status() === 400 && (await r.json()).field === 'kind');
  check('a body over 16 KB → 413', (await ca.post(BASE + '/api/cloud/feedback', { data: { kind: 'bug', text: 'z'.repeat(17_000), version: '1' } })).status() === 413);
  const cc = await ctlApi(LC.token);
  const st = [];
  for (let i = 0; i < 11; i++) st.push((await cc.post(BASE + '/api/cloud/feedback', { data: { kind: 'idea', text: 'idea ' + i, version: '0.1.120' } })).status());
  const last = await cc.post(BASE + '/api/cloud/feedback', { data: { kind: 'idea', text: 'one more', version: '0.1.120' } });
  check('10 per license per day, the 11th → 429 rate_limited', st.slice(0, 10).every((s) => s === 200) && st[10] === 429 && (await last.json()).error === 'rate_limited', st.join());
  r = await cb.post(BASE + '/api/cloud/feedback', { data: { kind: 'bug', text: 'Battery date not saved', version: '0.1.119' } });
  const bobCtlBug = (await r.json()).id;

  console.log('account API');
  const aa = await acctApi(ANNA), ab = await acctApi(BOB), anon = await acctApi(null);
  check('no session → 401', (await anon.get(BASE + '/api/account/feedback')).status() === 401 && (await anon.post(BASE + '/api/account/feedback', { data: { kind: 'bug', text: 'x' } })).status() === 401);
  r = await aa.post(BASE + '/api/account/feedback', { data: { kind: 'idea', text: 'Dark mode for the logbook' } });
  const annaIdea = (await r.json()).id;
  check('account POST → 200 {id}', r.status() === 200 && !!annaIdea);
  items = (await (await aa.get(BASE + '/api/account/feedback')).json()).items;
  check('account GET → controller and website items of the same account, newest first', items.length === 2 && items[0].id === annaIdea && items[1].id === annaBug);
  const evil = await request.newContext({ ignoreHTTPSErrors: true, extraHTTPHeaders: { cookie: 'pg_session=' + sid(ANNA), origin: 'https://evil.example' } });
  check('a cross-origin POST → 403', (await evil.post(BASE + '/api/account/feedback', { data: { kind: 'bug', text: 'x' } })).status() === 403);
  r = await ab.post(BASE + '/api/account/feedback', { data: { kind: 'bug', text: 'NAS stayed off after the outage' } });
  const bobWebBug = (await r.json()).id;

  console.log('isolation');
  const idsOf = async (ctx, path) => new Set(((await (await ctx.get(BASE + path)).json()).items ?? []).map((i) => i.id));
  const [aWeb, aCtl, bWeb, bCtl] = [await idsOf(aa, '/api/account/feedback'), await idsOf(ca, '/api/cloud/feedback'), await idsOf(ab, '/api/account/feedback'), await idsOf(cb, '/api/cloud/feedback')];
  check('Anna never sees Bob\'s items (website and controller)', ![bobCtlBug, bobWebBug].some((id) => aWeb.has(id) || aCtl.has(id)));
  check('Bob never sees Anna\'s items (website and controller)', ![annaBug, annaIdea].some((id) => bWeb.has(id) || bCtl.has(id)) && bWeb.has(bobCtlBug) && bWeb.has(bobWebBug));

  console.log('/feedback');
  for (const [name, opts] of [['iphone', IPHONE], ['desktop', { viewport: { width: 1280, height: 900 } }]]) {
    const out = await browser.newContext({ ...opts, ignoreHTTPSErrors: true });
    const op = await out.newPage();
    await op.goto(BASE + '/feedback', { waitUntil: 'networkidle' });
    check(`${name}: signed out → the sign-in link, no form`, (await op.locator('#fb-signin a[href="/login"]').count()) === 1 && (await op.locator('#fb-form').count()) === 0);
    await out.close();

    const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam' });
    await ctx.addCookies([cookie(ANNA)]);
    const page = await ctx.newPage();
    await page.goto(BASE + '/feedback', { waitUntil: 'networkidle' });
    await hydrated(page, '#fb-text');
    await page.waitForSelector('#fb-reports .fb-item');
    check(`${name}: signed in → the form (Problem/Idea) and Your reports`, (await page.locator('#fb-form').count()) === 1 && (await page.locator('#fb-kind-bug').getAttribute('aria-checked')) === 'true');
    const reports = (await page.textContent('#fb-reports')) ?? '';
    check(`${name}: HTML in feedback is shown as text`, reports.includes(XSS) && (await page.locator('#fb-reports img, #fb-reports b').count()) === 0 && !(await page.evaluate(() => window.__xss)));
    check(`${name}: only Anna's own reports`, !reports.includes('Battery date not saved') && !reports.includes('NAS stayed off'));
    check(`${name}: no sideways scrolling`, await noSideScroll(page));
    if (name === 'iphone') {
      await page.click('#fb-kind-idea');
      check('Idea asks "What would help you?"', ((await page.textContent('#fb-form')) ?? '').includes('What would help you?'));
      await page.click('#fb-send');
      check('sending an empty box: an inline message, nothing sent', ((await page.textContent('#fb-error')) ?? '').includes('few words'));
      await page.fill('#fb-text', 'Show the battery age on the overview');
      await page.click('#fb-send');
      await page.waitForSelector('#fb-done');
      await page.waitForFunction(() => document.querySelector('#fb-reports')?.textContent.includes('Show the battery age'), null, { timeout: 10_000 }).catch(() => {});
      check('sent: "Thanks, we got it", and it is listed', ((await page.textContent('#fb-done')) ?? '').includes('Thanks, we got it') &&
        ((await page.textContent('#fb-reports')) ?? '').includes('Show the battery age on the overview'));
    }
    await demo(page);
    await page.screenshot({ path: `${SHOTS}feedback-${name}.png`, fullPage: true });
    await ctx.close();
  }
  const bobPage = await browser.newContext({ ignoreHTTPSErrors: true });
  await bobPage.addCookies([cookie(BOB)]);
  const bp = await bobPage.newPage();
  await bp.goto(BASE + '/feedback', { waitUntil: 'networkidle' });
  await bp.waitForSelector('#fb-reports .fb-item');
  const bobText = (await bp.textContent('#fb-reports')) ?? '';
  check('Bob\'s /feedback shows his reports only', bobText.includes('Battery date not saved') && !bobText.includes('NAS did not wake up') && !bobText.includes('Dark mode'));
  await bobPage.close();

  console.log('/account');
  const acx = await browser.newContext({ ignoreHTTPSErrors: true });
  await acx.addCookies([cookie(ANNA)]);
  const ap = await acx.newPage();
  await ap.goto(BASE + '/account', { waitUntil: 'networkidle' });
  await hydrated(ap, '#fb-open');
  await ap.click('#fb-open');
  check('/account: the Feedback card opens the form inline', (await ap.locator('#feedback #fb-form').count()) === 1);
  await acx.close();

  console.log('admin');
  for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['iphone', IPHONE]]) {
    const adm = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, timezoneId: 'Europe/Amsterdam' });
    await adm.addCookies([cookie(ADMIN)]);
    const page = await adm.newPage();
    await page.goto(BASE + '/admin/feedback' + (name === 'iphone' ? '?status=all' : ''), { waitUntil: 'networkidle' });
    // desktop runs first, on the untouched data; the iPhone sees it after the desktop's merge, fix and reject
    const tabs = (await page.textContent('[aria-label="Channel"]')) ?? '';
    check(`admin (${name}): tabs Bugs and Ideas with their open counts`, name === 'desktop' ? /Bugs\s*3/.test(tabs) && /Ideas\s*12/.test(tabs) : /Bugs\s*0/.test(tabs) && /Ideas\s*11/.test(tabs), tabs);
    const list = (await page.textContent('#feedback-list')) ?? '';
    check(`admin (${name}): HTML in feedback is shown as text`, list.includes(XSS) && (await page.locator('#feedback-list img, #feedback-list b, #feedback-list script, #feedback-list i').count()) === 0 && !(await page.evaluate(() => window.__xss)));
    check(`admin (${name}): row shows count, customers, version and report id`, name === 'desktop'
      ? list.includes('1×') && list.includes('1 customer') && list.includes('0.1.120') && list.includes('PGR-ABCD-EFGH')
      : list.includes('3×') && list.includes('2 customers') && list.includes('0.1.119') && list.includes('Fixed in 0.1.121') && list.includes(XSS_REPLY));
    check(`admin (${name}): no sideways scrolling`, await noSideScroll(page));
    if (name === 'desktop') {
      const row = (id) => page.locator(`.feedback-row[data-id="${id}"]`);
      await hydrated(page, `.feedback-row[data-id="${annaBug}"] .fb-act-reply`);
      // Reply (HTML in the reply too)
      await row(annaBug).locator('.fb-act-reply').click();
      await row(annaBug).locator('.fb-reply-text').fill(XSS_REPLY);
      await row(annaBug).locator('.fb-reply-send').click();
      await page.waitForFunction((id) => document.querySelector(`.feedback-row[data-id="${id}"] .feedback-reply`), annaBug);
      // Merge Bob's two problems into Anna's
      for (const id of [bobCtlBug, bobWebBug]) {
        await row(id).locator('.fb-act-merge').click();
        await row(id).locator('.fb-merge-into').selectOption(annaBug);
        await row(id).locator('.fb-merge-go').click();
        await page.waitForFunction((x) => !document.querySelector(`.feedback-row[data-id="${x}"]`), id);
      }
      await page.waitForFunction((id) => document.querySelector(`.feedback-row[data-id="${id}"] .feedback-count`)?.textContent === '3×', annaBug);
      check('admin: merged → one row, 3×, 2 customers', ((await row(annaBug).textContent()) ?? '').includes('2 customers') && (await page.locator('.feedback-row').count()) === 1);
      // Fixed in
      await row(annaBug).locator('.fb-act-fixed').click();
      await row(annaBug).locator('.fb-fixed-version').fill('0.1.121');
      await row(annaBug).locator('.fb-fixed-go').click();
      await page.waitForFunction(() => !document.querySelector('.feedback-row'));
      check('admin: a fixed item leaves the Open filter', (await page.locator('.feedback-row').count()) === 0);
      await page.goto(BASE + '/admin/feedback?status=fixed', { waitUntil: 'networkidle' });
      check('admin: …and shows "Fixed in 0.1.121" under Fixed', ((await row(annaBug).locator('.feedback-status').textContent()) ?? '').includes('Fixed in 0.1.121'));
      // Reject an idea
      await page.goto(BASE + '/admin/feedback?kind=idea', { waitUntil: 'networkidle' });
      await hydrated(page, `.feedback-row[data-id="${annaIdea}"] .fb-act-reject`);
      await row(annaIdea).locator('.fb-act-reject').click();
      await page.waitForFunction((id) => !document.querySelector(`.feedback-row[data-id="${id}"]`), annaIdea);
      await page.goto(BASE + '/admin/feedback?kind=idea&status=rejected', { waitUntil: 'networkidle' });
      check('admin: Reject moves it from Open to Rejected', (await row(annaIdea).count()) === 1);
    }
    await demo(page);
    await page.screenshot({ path: `${SHOTS}feedback-admin-${name}.png`, fullPage: true });
    await adm.close();
  }

  console.log('what the reporters see');
  const bobItems = (await (await ab.get(BASE + '/api/account/feedback')).json()).items;
  const bm = bobItems.find((i) => i.id === bobWebBug), bc = (await (await cb.get(BASE + '/api/cloud/feedback')).json()).items.find((i) => i.id === bobCtlBug);
  check('the merged reporter sees the target\'s status, fixed_in and reply (website)', bm.status === 'fixed' && bm.fixed_in === '0.1.121' && bm.replies[0]?.text === XSS_REPLY && bm.text === 'NAS stayed off after the outage');
  check('…and through his controller', bc.status === 'fixed' && bc.fixed_in === '0.1.121' && bc.replies.length === 1);
  const annaItems = (await (await ca.get(BASE + '/api/cloud/feedback')).json()).items;
  check('Anna sees the reply and the fix on her controller', annaItems.find((i) => i.id === annaBug).replies[0].text === XSS_REPLY && annaItems.find((i) => i.id === annaBug).fixed_in === '0.1.121');
  check('…and her idea as rejected', annaItems.find((i) => i.id === annaIdea).status === 'rejected');
  const rc = await browser.newContext({ ...IPHONE, ignoreHTTPSErrors: true });
  await rc.addCookies([cookie(BOB)]);
  const rp = await rc.newPage();
  await rp.goto(BASE + '/feedback', { waitUntil: 'networkidle' });
  await rp.waitForSelector('#fb-reports .fb-reply');
  const item = rp.locator(`.fb-item[data-id="${bobWebBug}"]`);
  check('Bob\'s page: "Fixed in 0.1.121" and the reply, shown as text', ((await item.locator('.fb-status').textContent()) ?? '') === 'Fixed in 0.1.121' &&
    ((await item.locator('.fb-reply').textContent()) ?? '').includes(XSS_REPLY) && (await rp.locator('#fb-reports script, #fb-reports i').count()) === 0 && !(await rp.evaluate(() => window.__xss)));
  check('Bob\'s page (iPhone): no sideways scrolling', await noSideScroll(rp));
  await demo(rp);
  await rp.screenshot({ path: `${SHOTS}feedback-replied-iphone.png`, fullPage: true });
  await rc.close();
  for (const c of [ca, cb, cc, bad, none, aa, ab, anon, evil]) await c.dispose();
} catch (e) { check('script error: ' + (e?.message ?? e), false); console.log(stack.log.text.slice(-4000)); }
finally {
  await browser.close();
  stack.stop();
  const { passed, failed } = result();
  console.log(`\n${passed} passed, ${failed} failed`);
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}
