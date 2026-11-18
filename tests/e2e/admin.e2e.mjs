// Admin pages: every /admin URL (one catch-all route on Cloudflare, see app/admin/[[...path]]) sends anonymous
// visitors and signed-in customers to /login, renders its own page for the admin, keeps its query parameters, and an
// unknown admin path is a 404. Demo data only.
//   cd tests/e2e && npm install && node admin.e2e.mjs
import { request } from 'playwright';
import { randomBytes } from 'node:crypto';
import { startStack, check, result, BASE } from './stack.mjs';
import { ADMIN } from '../../scripts/cloud-dev.mjs';

const stack = await startStack();
const DAY = 86_400_000, now = Date.now();
const CUSTOMER = 'demo@example.test';
const lic = { id: 'lic-demo', email: CUSTOMER, plan: 'pro', site_id: 'default-site', site_name: 'Head office', connector_limit: 5, expires_at: null,
  status: 'active', notes: '', created_at: new Date(now - 40 * DAY).toISOString(), token: 'tok-demo-' + 'a'.repeat(24) };
stack.kv.set('license:' + lic.id, JSON.stringify(lic));
stack.kv.set('index:token:' + lic.token, lic.id);
stack.kv.set('index:all', JSON.stringify([lic.id]));

const as = (email) => {
  const headers = {};
  if (email) {
    const sid = randomBytes(32).toString('hex');
    stack.kv.set('session:' + sid, JSON.stringify({ email, expires: now + DAY, mfa: true }));
    headers.cookie = 'pg_session=' + sid;
  }
  return request.newContext({ ignoreHTTPSErrors: true, extraHTTPHeaders: headers });
};

// [path, the page's own heading]
const PAGES = [
  ['/admin', 'Overview'],
  ['/admin/audit', 'Audit log'],
  ['/admin/audit?who=customer', 'Audit log'],
  ['/admin/licenses', 'Licenses'],
  ['/admin/licenses?status=expiring', 'Licenses'],
  ['/admin/licenses/new', 'New customer license'],
  ['/admin/licenses/new?email=' + encodeURIComponent(CUSTOMER), 'Add a site'],
  ['/admin/tenants', 'Customers'],
  ['/admin/tenants?status=active&q=demo', 'Customers'],
  ['/admin/testers', 'Testers'],
  ['/admin/feedback', 'Feedback'],
  ['/admin/feedback?kind=idea&status=all', 'Feedback'],
  ['/admin/customers/' + encodeURIComponent(CUSTOMER), CUSTOMER],
  ['/admin/customers/' + encodeURIComponent('nobody@example.test'), 'nobody@example.test'],
];
const heading = (html) => html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1].replace(/<[^>]+>/g, '').trim();

try {
  for (const [who, email] of [['anonymous', null], ['a signed-in customer', CUSTOMER]]) {
    const ctx = await as(email);
    for (const [p] of PAGES) {
      const res = await ctx.get(BASE + p);
      check(`${who}: ${p} sends you to sign in`, new URL(res.url()).pathname === '/login', res.url());
    }
    await ctx.dispose();
  }

  const adm = await as(ADMIN);
  for (const [p, text] of PAGES) {
    const res = await adm.get(BASE + p);
    const h1 = heading(await res.text());
    check(`admin: ${p} renders its page`, res.status() === 200 && new URL(res.url()).pathname === new URL(BASE + p).pathname && h1 === text,
      `${res.status()} ${res.url()} h1=${h1}`);
  }
  check('admin: a repeated query param takes the first value (no crash)', (await (await adm.get(BASE + '/admin/tenants?q=demo&q=other')).text()).includes('value="demo"'));
  check('admin: the tenants search keeps its query', (await (await adm.get(BASE + '/admin/tenants?q=demo')).text()).includes('value="demo"'));
  for (const p of ['/admin/nope', '/admin/customers', '/admin/customers/a/b', '/admin/licenses/new/x', '/admin/sections/overview', '/admin/licenses%2Fnew']) {
    check(`admin: ${p} is not found (404)`, (await adm.get(BASE + p)).status() === 404);
  }
  await adm.dispose();
} catch (e) { check('script error: ' + (e?.message ?? e), false); }
finally {
  stack.stop();
  const { passed, failed } = result();
  console.log(`\n${passed} passed, ${failed} failed`);
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
}
