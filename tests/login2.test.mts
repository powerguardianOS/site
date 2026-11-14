// LOGIN-2: the sign-in link opened in the browser that asked signs in at once (no button) and the tab that asked goes
// on by itself; anywhere else (a mail scanner, another device) the GET changes nothing and shows "Sign in on this
// device". One request = one pending sign-in: link and code, bound to the browser cookie, one used kills the other,
// 5 wrong codes kill both, 15 minutes. The mail: logo, short heading, one button, the code spaced, the raw link small.
// Run: npx tsx tests/login2.test.mts
import { kv, mails, seed, lic, check, done } from './harness.mts';
import { NextRequest } from 'next/server';

const { POST: register } = await import('../app/api/auth/register/route.ts');
const verify = await import('../app/api/auth/verify/route.ts');
const { POST: codePOST } = await import('../app/api/auth/code/route.ts');
const { GET: statusGET } = await import('../app/api/auth/status/route.ts');
const { GET: continueGET } = await import('../app/api/auth/continue/route.ts');
const { GET: mfaGET } = await import('../app/login/mfa/route.ts');
const { LOGO_URL } = await import('../app/lib/email-template.ts');
const { getSession } = await import('../app/lib/session.ts');
const { createAccount } = await import('../app/lib/accounts.ts');
await createAccount('ann@x.nl');

seed(lic('site-roy', 'roy@x.nl', { plan: 'pro', claimed_by: 'a'.repeat(64), site_name: 'Acer' })); // roy manages a site → two-step
const O = 'https://powerguardian.cloud';
let ipN = 0;
const ask = async (email: string, app = true) => { // app: asked from the installed app, the only case with a code
  const r = await register(new Request(O + '/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: O, 'cf-connecting-ip': `9.9.9.${++ipN}` }, body: JSON.stringify({ email, app }),
  }));
  const m = mails.filter((x) => x.to === email).at(-1)!;
  const nonce = (r.headers.get('set-cookie') ?? '').match(/pg_login_req=([0-9a-f]{64})/)?.[1] ?? '';
  return { r, m, nonce, link: m.text.match(/https?:\/\/\S+\/api\/auth\/verify\?token=[0-9a-f]+/)![0], code: m.text.match(/\b(\d{6})\b/)?.[1] ?? '' };
};
const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;
const get = (link: string, cookie = '') => verify.GET(new NextRequest(link, { headers: cookie ? { cookie } : {} }));
const post = (token: string, cookie = '') => verify.POST(new NextRequest(O + '/api/auth/verify', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: O, ...(cookie ? { cookie } : {}) }, body: new URLSearchParams({ token }).toString(),
}));
const sendCode = (code: string, cookie: string) => codePOST(new NextRequest(O + '/api/auth/code', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: O, cookie }, body: JSON.stringify({ code }),
}));
const status = async (cookie = '') => (await statusGET(new Request(O + '/api/auth/status', { headers: cookie ? { cookie } : {} }))).json();
const cont = (cookie: string) => continueGET(new NextRequest(O + '/api/auth/continue', { headers: { cookie } }));
const sc = (r: Response) => r.headers.getSetCookie().join('\n');
const cookieVal = (r: Response, n: string) => r.headers.getSetCookie().map((c) => c.match(new RegExp(`^${n}=([^;]*)`))?.[1]).find((v) => v !== undefined) ?? '';
const loc = (r: Response) => new URL(r.headers.get('location') ?? '/', O);
const wrong = (c: string) => (c === '000000' ? '111111' : '000000');

console.log('the mail');
await ask('web@x.nl', false); const web = await ask('web@x.nl', false); // the second: an existing account
check('from a browser: a magic link only, no code anywhere (subject, text, HTML)', web.code === '' && web.m.subject === 'Sign in to PowerGuardian' && !/\b\d{6}\b/.test(web.m.text.replace(web.link, '')) && !web.m.html.includes('pg-code"') && (web.m.html.match(/>Sign in<\/a>/g) ?? []).length === 1 && web.m.text.includes('Sign in with the link below.'));
let a = await ask('ann@x.nl');
check('subject carries the code; text: code, link, expiry line', a.m.subject.includes(a.code) && a.m.text.includes(`Your code: ${a.code}`) && a.m.text.includes("Expires in 15 minutes. Didn't ask? Ignore this email.") && a.m.text.includes(a.link), a.m.subject);
check('HTML: the PNG logo by absolute https URL, no SVG', a.m.html.includes(`src="${LOGO_URL}"`) && LOGO_URL.startsWith('https://powerguardian.cloud/') && LOGO_URL.endsWith('.png') && !/<svg/i.test(a.m.html));
check('HTML: heading "Sign in to PowerGuardian", one button, the code big and spaced', /<h1[^>]*>Sign in to PowerGuardian<\/h1>/.test(a.m.html) && (a.m.html.match(/>Sign in<\/a>/g) ?? []).length === 1 && a.m.html.includes(`${a.code.slice(0, 3)} ${a.code.slice(3)}</div>`));
check('HTML: the raw link small at the bottom (after the code)', a.m.html.lastIndexOf(a.link) > a.m.html.indexOf('pg-code') && /font-size:12px[^>]*>Button not working/.test(a.m.html));
const welcome = await ask('new-' + Date.now() + '@x.nl');
check('a new account gets "Welcome to PowerGuardian", with the same code and link', welcome.m.subject === 'Welcome to PowerGuardian' && welcome.m.html.includes('Welcome to PowerGuardian') && welcome.m.text.includes(welcome.code));
const setCk = a.r.headers.get('set-cookie') ?? '';
check('the browser that asked gets pg_login_req: HttpOnly, Secure, SameSite=Lax, /api/auth, 15 min', !!a.nonce && /HttpOnly/.test(setCk) && /Secure/.test(setCk) && /SameSite=Lax/.test(setCk) && /Path=\/api\/auth;/.test(setCk) && /Max-Age=900/.test(setCk));
check('KV holds neither the code nor the nonce in clear', ![...kv.entries()].some(([k, v]) => k.includes(a.nonce) || v.includes(a.nonce) || v.includes(`"${a.code}"`)));
const known = await (await register(new Request(O + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.1' }, body: JSON.stringify({ email: 'ann@x.nl' }) }))).text();
const unknown = await (await register(new Request(O + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.2' }, body: JSON.stringify({ email: 'zed-' + Date.now() + '@x.nl' }) }))).text();
check('known and unknown addresses get the same answer (no enumeration)', known === unknown && known === '{"ok":true}', known + ' / ' + unknown);

console.log('\na scanner or another device: nothing happens without the tap');
a = await ask('ann@x.nl');
const ck = `pg_login_req=${a.nonce}`;
let r = await get(a.link, 'pg_login_req=' + 'f'.repeat(64));
let html = await r.text();
check('GET without the matching cookie: one "Sign in" button, no code talk', r.status === 200 && html.includes('>Sign in</button>') && !/\bcode from|type the code/i.test(html));
r = await get(a.link);
check('…no session, the link and the code still live', !sc(r).includes('pg_session') && kv.has('magic:' + tokenOf(a.link)));
check('the tab that asked still sees pending', (await status(ck)).state === 'pending');
check('status without the cookie says expired, and nothing else', JSON.stringify(await status()) === '{"state":"expired"}');

console.log('\nthe same browser: signed in at once, the tab that asked follows');
r = await get(a.link, ck);
html = await r.text();
const sess = cookieVal(r, 'pg_session');
check('GET with the cookie: signed in (pg_session) on "You\'re signed in. You can close this page."', r.status === 200 && !!sess && html.includes("You&#39;re signed in") && html.includes('You can close this page.'), String(r.status));
check('…with a quiet "Go to My sites" link', /<a href="\/account" id="signin-my-sites"[^>]*>Go to My sites<\/a>/.test(html));
check('…the session is valid', (await getSession(decodeURIComponent(sess))) === 'ann@x.nl');
check('…the nudge script is allowed by its hash only', /script-src 'sha256-[A-Za-z0-9+/=]+'/.test(r.headers.get('content-security-policy') ?? '') && !/unsafe-inline'[^;]*;?\s*$/.test((r.headers.get('content-security-policy') ?? '').split('script-src')[1] ?? ''));
check('…the link is used up', !kv.has('magic:' + tokenOf(a.link)));
check('status before this browser has the cookies: still pending', (await status(ck)).state === 'pending');
const both = `${ck}; pg_login_done=1; pg_session=${sess}`;
check('status with them: done', JSON.stringify(await status(both)) === '{"state":"done"}');
r = await cont(both);
check('the tab that asked continues to /account', r.status === 303 && loc(r).pathname === '/account');
check('…and the pending sign-in is ended (cookies cleared)', /pg_login_req=;/.test(sc(r)) && /pg_login_done=;/.test(sc(r)) && (await status(both)).state === 'expired');
r = await get(a.link, ck);
check('the link again (reload): signed in → /account, else expired', loc(r).pathname === '/login' && loc(r).searchParams.get('error') === 'link');
check('the code after the link: refused', (await sendCode(a.code, ck)).status === 401);

console.log('\nanother device taps the button');
a = await ask('ann3@x.nl');
r = await post(tokenOf(a.link));
check('the button (no cookie) signs that device in', r.status === 303 && !!cookieVal(r, 'pg_session'));
check('…the code is dead now', (await (await sendCode(a.code, `pg_login_req=${a.nonce}`)).json()).error === 'expired');
check('…and the tab that asked sees expired (not done)', (await status(`pg_login_req=${a.nonce}; pg_login_done=1`)).state === 'expired');

console.log('\nthe code kills the link');
a = await ask('ann4@x.nl');
r = await sendCode(a.code, `pg_login_req=${a.nonce}`);
check('the code (with the cookie) signs in', r.status === 200 && (await r.json()).next === '/account' && !!cookieVal(r, 'pg_session'));
r = await get(a.link, `pg_login_req=${a.nonce}`);
check('the link afterwards: expired, no session', loc(r).searchParams.get('error') === 'link' && !cookieVal(r, 'pg_session'));
check('…also via the button', loc(await post(tokenOf(a.link))).searchParams.get('error') === 'link');

console.log('\n5 wrong codes kill the pending sign-in');
a = await ask('ann5@x.nl');
let last: any = null;
for (let i = 0; i < 5; i++) last = await (await sendCode(wrong(a.code), `pg_login_req=${a.nonce}`)).json();
check('the 5th wrong code: no tries left', last.error === 'wrong' && last.left === 0, JSON.stringify(last));
check('…the right code is refused', (await sendCode(a.code, `pg_login_req=${a.nonce}`)).status === 401);
check('…the link is dead (GET and button)', loc(await get(a.link)).searchParams.get('error') === 'link' && loc(await post(tokenOf(a.link))).searchParams.get('error') === 'link');
check('…the tab that asked sees expired', (await status(`pg_login_req=${a.nonce}`)).state === 'expired');

console.log('\nexpiry');
a = await ask('ann6@x.nl');
const rk = [...kv.keys()].find((k) => k.startsWith('signin:req:') && JSON.parse(kv.get(k)!).email === 'ann6@x.nl')!;
kv.set(rk, JSON.stringify({ ...JSON.parse(kv.get(rk)!), exp: Date.now() - 1 }));
check('after 15 minutes: status expired, code refused, link dead', (await status(`pg_login_req=${a.nonce}`)).state === 'expired'
  && (await sendCode(a.code, `pg_login_req=${a.nonce}`)).status === 401 && loc(await get(a.link, `pg_login_req=${a.nonce}`)).searchParams.get('error') === 'link');

console.log('\ntwo-step accounts keep two-step');
a = await ask('roy@x.nl');
r = await get(a.link, `pg_login_req=${a.nonce}`);
check('same browser, MFA account: on to /login/mfa, no session yet', r.status === 303 && loc(r).pathname === '/login/mfa' && !!cookieVal(r, 'pg_signin') && !cookieVal(r, 'pg_session'));
const rb = `pg_login_req=${a.nonce}; pg_login_done=1`;
check('the tab that asked: done', (await status(rb)).state === 'done');
r = await cont(rb);
check('…and goes to the two-step page too (no session without the code)', loc(r).pathname === '/login/mfa' && !cookieVal(r, 'pg_session'));
const m2 = await mfaGET(new Request(O + '/login/mfa', { headers: { cookie: `pg_signin=${'0'.repeat(64)}; pg_session=${sess}` } }));
check('a second two-step tab, after the first finished: → /account, not "took too long"', loc(m2).pathname === '/account');
const m3 = await mfaGET(new Request(O + '/login/mfa', { headers: { cookie: `pg_signin=${'0'.repeat(64)}` } }));
check('…without a session it still says timeout', loc(m3).searchParams.get('error') === 'timeout');

console.log('\na controller flow continues in the tab that asked');
a = await ask('ann8@x.nl');
const t = 'ab'.repeat(24);
r = await get(a.link, `pg_login_req=${a.nonce}; pg_open_next=${t}`);
const s2 = cookieVal(r, 'pg_session');
check('the link tab clears the remembered ticket', /pg_open_next=;/.test(sc(r)) && !!s2);
r = await cont(`pg_login_req=${a.nonce}; pg_login_done=1; pg_session=${s2}`);
check('the tab that asked goes on to the site switch', loc(r).pathname === '/console/open' && loc(r).searchParams.get('t') === t, loc(r).toString());
a = await ask('ann8@x.nl');
r = await get(a.link, `pg_login_req=${a.nonce}`);
const k3 = [...kv.keys()].find((k) => k.startsWith('signin:req:') && JSON.parse(kv.get(k)!).state === 'done')!;
kv.set(k3, JSON.stringify({ ...JSON.parse(kv.get(k3)!), next: '//evil.example/x' }));
r = await cont(`pg_login_req=${a.nonce}; pg_login_done=1; pg_session=${cookieVal(r, 'pg_session')}`);
check('continue only ever goes to a path on this site', loc(r).host === 'powerguardian.cloud' && loc(r).pathname === '/account', loc(r).toString());
r = await cont('pg_login_req=' + 'e'.repeat(64));
check('continue without a done sign-in: → /login, cookies kept', loc(r).pathname === '/login' && !sc(r).includes('pg_login_req'));

done();
