// Sign in with a 6-digit code from the e-mail, for a browser that cannot open the sign-in link itself: the installed
// home-screen app (its own cookie jar; a mail link opens in Safari/Gmail) and controller sign-ins (CLOUD-SSO, the site
// switcher). The same request mails a link AND, when asked, a code bound to the browser that asked (HttpOnly cookie).
// Same rate limits as the link, single use, 15 minutes, 5 tries. Then two-step sign-in as usual.
// Run: npx tsx tests/signin-code.test.mts
import { kv, mails, seed, lic, check, done } from './harness.mts';
import { NextRequest } from 'next/server';

const { POST: register } = await import('../app/api/auth/register/route.ts');
const { POST: codePOST } = await import('../app/api/auth/code/route.ts');
const { CODE_TTL_S, CODE_MAX_TRIES } = await import('../app/lib/signin-code.ts');

seed(lic('site-roy', 'roy@x.nl', { plan: 'pro', claimed_by: 'a'.repeat(64), site_name: 'Acer' }));
const O = 'https://powerguardian.cloud';
const ask = (email: string, code: boolean, ip = '1.1.1.1') => register(new Request(O + '/api/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: O, 'cf-connecting-ip': ip }, body: JSON.stringify({ email, ...(code ? { code: true } : {}) }),
}));
const send = (code: string, cookie: string, origin: string | null = O) => codePOST(new NextRequest(O + '/api/auth/code', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ code }),
}));
const bindOf = (r: Response) => (r.headers.get('set-cookie') ?? '').match(/pg_code=([^;]+)/)?.[1] ?? '';
const codeIn = (to: string) => mails.filter((m) => m.to === to).at(-1)?.text.match(/\b(\d{6})\b/)?.[1] ?? '';

console.log('asking for a code');
let r = await ask('roy@x.nl', true);
const bind = bindOf(r);
const sc = r.headers.get('set-cookie') ?? '';
check('the request is answered ok and binds this browser with an HttpOnly cookie', r.status === 200 && !!bind && /HttpOnly/.test(sc) && /Secure/.test(sc) && /Path=\/api\/auth\/code/.test(sc) && new RegExp(`Max-Age=${CODE_TTL_S}\\b`).test(sc), sc);
const code = codeIn('roy@x.nl');
check('the mail carries a 6-digit code and still the link', /^\d{6}$/.test(code) && /\/api\/auth\/verify\?token=/.test(mails.at(-1)!.text));
check('the code lives 10–15 minutes, at most 5 tries', CODE_TTL_S >= 600 && CODE_TTL_S <= 900 && CODE_MAX_TRIES === 5);
check('KV never holds the code in clear', ![...kv.values()].some((v) => v.includes(`"${code}"`)));
r = await ask('nobody-code@x.nl', false);
check('without code:true no code cookie is set (the link only, as before)', r.status === 200 && !bindOf(r));

console.log('\nentering it');
let v = await send(code, '');
check('without the browser cookie (another browser) → refused', v.status === 401 && !(v.headers.get('set-cookie') ?? '').includes('pg_session='));
v = await send(code, 'pg_code=' + bind, 'https://evil.example');
check('a cross-site post → refused', v.status === 403);
v = await send(code === '000000' ? '111111' : '000000', 'pg_code=' + bind);
let j = await v.json();
check('a wrong code → refused, tries left shown', v.status === 401 && j.error === 'wrong' && j.left === CODE_MAX_TRIES - 1, JSON.stringify(j));
v = await send(code, 'pg_code=' + bind);
j = await v.json();
check('the right code → on to two-step sign-in (roy manages a site)', v.status === 200 && j.ok === true && j.next === '/login/mfa' && /pg_signin=/.test(v.headers.get('set-cookie') ?? ''), JSON.stringify(j));
check('…and the code cookie is cleared', /pg_code=;/.test(v.headers.get('set-cookie') ?? ''));
v = await send(code, 'pg_code=' + bind);
check('the code used again → refused (single use)', v.status === 401);

console.log('\nfrom a controller flow, the browser goes on there after signing in');
r = await ask('roy@x.nl', true, '2.2.2.2');
const b2 = bindOf(r), c2 = codeIn('roy@x.nl');
v = await send(c2, `pg_code=${b2}; pg_open_next=${'ab'.repeat(24)}`);
j = await v.json();
const step = (v.headers.get('set-cookie') ?? '').match(/pg_signin=([0-9a-f]+)/)?.[1] ?? '';
check('a pending switch ticket is continued after the code (and two-step)', j.ok && JSON.parse(kv.get('signin:step:' + step) ?? '{}').next === `/console/open?t=${'ab'.repeat(24)}`, kv.get('signin:step:' + step) ?? '');
check('the remembered ticket cookie is cleared', /pg_open_next=;/.test(v.headers.get('set-cookie') ?? ''));

console.log('\nlimits');
r = await ask('eve@x.nl', true, '3.3.3.3');
const b3 = bindOf(r), c3 = codeIn('eve@x.nl');
for (let i = 0; i < CODE_MAX_TRIES; i++) await send(c3 === '000000' ? '111111' : '000000', 'pg_code=' + b3);
v = await send(c3, 'pg_code=' + b3);
check('after 5 wrong codes even the right one is refused (start again)', v.status === 401);
let limited = false;
for (let i = 0; i < 4; i++) { const x = await ask('flood@x.nl', true, '4.4.4.4'); if (x.status === 429) limited = true; }
check('asking for codes has the same per-address limit as links', limited);

done();
