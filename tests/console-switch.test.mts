// AUTO-SSO from the controller's site switcher: on Acer tap HP → land signed in on HP through the relay.
// The controller asks the cloud for HP's console link (server to server, /api/cloud/sites/console) and names the cloud
// account its user is linked to (actor). Only when that is the account that owns both licences does the cloud add an
// open_url: a single-use, site-bound and account-bound switch ticket on powerguardian.cloud (app/lib/console-switch.ts).
// The browser goes there; with its own PG Cloud session of that account (sign in first when there is none, then it
// continues) the ticket is burned, HP's console link is minted together with the console intent, and the browser lands
// on HP, which then signs in by itself (tests/console-intent.test.mts).
// Run: npx tsx tests/console-switch.test.mts
import { kv, put, seed, lic, check, done } from './harness.mts';
import { createSession } from '../app/lib/session.ts';
import { createMagicToken } from '../app/lib/magic-link.ts';
import { NextRequest } from 'next/server';

process.env.RELAY_MINT_SECRET = 'mint-secret';
const mints: string[] = [];
const kvFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  if (String(url).startsWith('https://relay.powerguardian.cloud/mint/')) { mints.push(String(url).split('/').pop()!); return Response.json({ token: 'sub.tok', jti: 'j', expires_at: 1 }); }
  return kvFetch(url, init);
};
const { POST: cloudConsole } = await import('../app/api/cloud/sites/console/route.ts');
const { GET: openGET } = await import('../app/console/open/route.ts');
const { POST: verify } = await import('../app/api/auth/verify/route.ts');
const { siteLabel } = await import('../app/lib/relay-mint.ts');
const { intentCookieName } = await import('../app/lib/console-intent.ts');
const { SWITCH_TTL_S } = await import('../app/lib/console-switch.ts');

const C_ACER = 'a'.repeat(64), C_HP = 'b'.repeat(64), C_MAL = 'd'.repeat(64);
const acer = lic('lic-acer', 'acme@test', { plan: 'pro', site_name: 'Acer', claimed_by: C_ACER });
const hp = lic('lic-hp', 'acme@test', { plan: 'pro', site_name: 'HP', claimed_by: C_HP });
const mal = lic('lic-mal', 'mallory@test', { plan: 'pro', site_name: 'Mal', claimed_by: C_MAL });
seed(acer, hp, mal);
for (const id of ['lic-acer', 'lic-hp', 'lic-mal']) put('sitestatus:' + id, { site_name: id, devices: [], received_at: Date.now() - 30_000, lan: id === 'lic-hp' ? ['8.8.8.8', '192.168.10.235'] : ['192.168.10.175'] });
const acme = await createSession('acme@test', { mfa: true });
const mallory = await createSession('mallory@test', { mfa: true });

const ask = (token: string, cid: string, body: unknown) => cloudConsole(new Request('https://powerguardian.cloud/api/cloud/sites/console', {
  method: 'POST', headers: { authorization: 'Bearer ' + token, 'x-controller-id': cid, 'content-type': 'application/json' }, body: JSON.stringify(body),
}));
const json = async (r: Response) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }) as any;
const open = (url: string, session?: string) => openGET(new Request(url, { headers: session ? { cookie: 'pg_session=' + session } : {} }));
const OPEN_RE = /^https:\/\/powerguardian\.cloud\/console\/open\?t=[0-9a-f]{48}$/;
const hpHost = `${await siteLabel('lic-hp')}-console.powerguardian.cloud`;

console.log('the controller asks for HP\'s console link');
let r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-hp', actor: 'acme@test' }));
check('a linked admin of the owning account: the console link AND an open_url (switch ticket)', r.status === 200 && r.console_url?.includes(hpHost) && OPEN_RE.test(r.open_url ?? ''), JSON.stringify(r));
const ticketURL = r.open_url as string;
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-hp' }));
check('a user not linked to a cloud account (no actor): the console link only, as before', r.status === 200 && !!r.console_url && !r.open_url, JSON.stringify(r));
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-hp', actor: 'mallory@test' }));
check('an actor that is not the owning account: no open_url', r.status === 200 && !r.open_url, JSON.stringify(r));
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-mal', actor: 'acme@test' }));
check('acme\'s controller asking for mallory\'s site → 404, no link, no ticket', r.status === 404 && !r.console_url && !r.open_url, JSON.stringify(r));
r = await json(await ask(mal.token, C_MAL, { site_id: 'lic-hp', actor: 'acme@test' }));
check('mallory\'s controller naming acme as actor for HP → 404, no ticket', r.status === 404 && !r.open_url, JSON.stringify(r));
check('a ticket never carries the e-mail or the site id in the link', !ticketURL.includes('acme') && !ticketURL.includes('lic-hp'));

console.log('\nthe browser opens the ticket');
const before = mints.length;
let o = await open(ticketURL, mallory);
check('another account\'s session → refused, nothing minted, no redirect to HP', o.status === 403 && mints.length === before && !o.headers.get('location'));
o = await open(ticketURL);
check('no cloud session → sign in first, the ticket remembered in a short cookie', o.status === 303 && o.headers.get('location') === '/login?next=console' && /pg_open_next=[0-9a-f]{48}/.test(o.headers.get('set-cookie') ?? '') && /HttpOnly/.test(o.headers.get('set-cookie') ?? ''));
const vr = await verify(new NextRequest('https://powerguardian.cloud/api/auth/verify', {
  method: 'POST', body: new URLSearchParams({ token: await createMagicToken('acme@test') }).toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://powerguardian.cloud', cookie: 'pg_open_next=' + new URL(ticketURL).searchParams.get('t') },
}));
const step = (vr.headers.get('set-cookie') ?? '').match(/pg_signin=([0-9a-f]+)/)?.[1] ?? '';
const next = step && kv.has('signin:step:' + step) ? JSON.parse(kv.get('signin:step:' + step)!).next as string : '';
check('after signing in (and two-step) the browser continues to the ticket', next === new URL(ticketURL).pathname + new URL(ticketURL).search, next);
check('the remembered ticket cookie is cleared', /pg_open_next=;/.test(vr.headers.get('set-cookie') ?? ''));
o = await open(ticketURL, acme);
const loc = o.headers.get('location') ?? '';
check('the owning account\'s session → straight to HP\'s console', o.status === 303 && loc.startsWith(`https://${hpHost}/console/`), loc);
check('…minted for HP with the account as actor', mints.at(-1) === 'lic-hp');
const sc = o.headers.get('set-cookie') ?? '';
check('…with the console intent for HP (so HP signs in by itself)', sc.startsWith((await intentCookieName('lic-hp')) + '=ci1.') && /Path=\/sso\/authorize/.test(sc), sc);
o = await open(ticketURL, acme);
check('the ticket replayed → expired page, nothing minted', o.status === 410 && !o.headers.get('location'));
o = await open('https://powerguardian.cloud/console/open?t=' + 'f'.repeat(48), acme);
check('an unknown ticket → expired page', o.status === 410);
o = await open('https://powerguardian.cloud/console/open?t=../x', acme);
check('a malformed ticket → expired page', o.status === 410);
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-hp', actor: 'acme@test' }));
const t2 = new URL(r.open_url).searchParams.get('t')!;
const rec = JSON.parse(kv.get('cs:' + t2)!); rec.exp = Math.floor(Date.now() / 1000) - 1; kv.set('cs:' + t2, JSON.stringify(rec));
o = await open(r.open_url, acme);
check('an expired ticket → expired page', o.status === 410 && !o.headers.get('location'));
check('tickets live at most ten minutes', SWITCH_TTL_S <= 600);
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-hp', actor: 'acme@test' }));
put('license:lic-hp', { ...hp, email: 'someone-else@test' });
o = await open(r.open_url, acme);
check('HP moved to another account after the ticket → refused, nothing minted', o.status === 403 && !o.headers.get('location'));

console.log('\non the LAN: straight to HP\'s LAN address, still signed in by itself');
put('license:lic-hp', hp);
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-hp', actor: 'acme@test', via: 'lan' }));
check('via lan for a linked admin: an open_url only (no relay link is minted, the plan does not matter)', r.status === 200 && OPEN_RE.test(r.open_url ?? '') && !r.console_url, JSON.stringify(r));
const before2 = mints.length;
o = await open(r.open_url, acme);
check('the ticket sends the browser to HP\'s reported private LAN address, asking it to sign in by itself', o.status === 303 && o.headers.get('location') === 'https://192.168.10.235/?sso=auto', o.headers.get('location') ?? '');
check('…with HP\'s console intent, and no relay link minted', (o.headers.get('set-cookie') ?? '').startsWith((await intentCookieName('lic-hp')) + '=ci1.') && mints.length === before2);
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-hp', via: 'lan' }));
check('via lan without a linked account → refused (the page then opens the LAN address directly)', r.status === 403 && !r.open_url, JSON.stringify(r));
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-mal', actor: 'acme@test', via: 'lan' }));
check('via lan for mallory\'s site → 404, no ticket', r.status === 404 && !r.open_url, JSON.stringify(r));
put('sitestatus:lic-hp', { site_name: 'HP', devices: [], received_at: Date.now() - 30_000, lan: ['8.8.8.8'] });
r = await json(await ask(acer.token, C_ACER, { site_id: 'lic-hp', actor: 'acme@test', via: 'lan' }));
check('via lan when HP reported no private address → no ticket', r.status === 409 && !r.open_url, JSON.stringify(r));

done();
