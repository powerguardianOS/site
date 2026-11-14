// AUTO-SSO: Open Console lands the owner signed in on the controller (like UniFi Site Manager → console). When the
// portal mints a console link it also leaves a short-lived, single-use, site-bound and session-bound "console intent"
// (an HttpOnly cookie on powerguardian.cloud, app/lib/console-intent.ts). /sso/authorize completes without the Continue
// tap only with that intent, for a session that passed two-step sign-in, returning to that very site's console host.
// Everything else gets the Continue page (or no access) exactly as before.
// Run: npx tsx tests/console-intent.test.mts
import { kv, seed, lic, check, done, PUBKEY } from './harness.mts';
import { createSession } from '../app/lib/session.ts';
import { SSO_PREFIX } from '../app/lib/sso.ts';

process.env.RELAY_MINT_SECRET = 'mint-secret';
const kvFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  if (String(url).startsWith('https://relay.powerguardian.cloud/mint/')) return Response.json({ token: 'sub.tok', jti: 'j', expires_at: 1 });
  return kvFetch(url, init);
};
const { POST: relaySession } = await import('../app/api/account/relay-session/route.ts');
const { GET } = await import('../app/sso/authorize/route.ts');
const { siteLabel } = await import('../app/lib/relay-mint.ts');
const { mintConsoleIntent, intentCookieName, INTENT_TTL_S } = await import('../app/lib/console-intent.ts');

const CTRL_A = 'a'.repeat(64), CTRL_A2 = 'c'.repeat(64), CTRL_B = 'b'.repeat(64);
seed(
  lic('site-roy', 'roy@x.nl', { plan: 'founder', claimed_by: CTRL_A, site_name: 'Acer' }),
  lic('site-roy2', 'roy@x.nl', { plan: 'pro', claimed_by: CTRL_A2, site_name: 'HP' }),
  lic('site-eve', 'eve@x.nl', { plan: 'pro', claimed_by: CTRL_B, site_name: 'Eve' }),
);
const roy = await createSession('roy@x.nl', { mfa: true });
const royOther = await createSession('roy@x.nl', { mfa: true });
const royNoMfa = await createSession('roy@x.nl');
const eve = await createSession('eve@x.nl', { mfa: true });
const host = async (id: string) => `${await siteLabel(id)}-console.powerguardian.cloud`;
const RET_ROY = `https://${await host('site-roy')}/api/auth/sso/callback`;
const RET_ROY2 = `https://${await host('site-roy2')}/api/auth/sso/callback`;
const RET_LAN = 'https://192.168.10.235/api/auth/sso/callback';
let n = 0;
const nonce = () => (++n).toString(16).padStart(48, 'e');

// the portal's Open Console: returns the Set-Cookie of the console intent
async function openConsole(session: string, licenseId: string) {
  const r = await relaySession(new Request('https://powerguardian.cloud/api/account/relay-session', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'pg_session=' + session, origin: 'https://powerguardian.cloud' },
    body: JSON.stringify({ license_id: licenseId }),
  }));
  const setCookie = r.headers.get('set-cookie') ?? '';
  return { status: r.status, body: await r.json().catch(() => ({})), setCookie, pair: setCookie.split(';')[0] };
}
const authorize = (o: { controller?: string; ret?: string; session?: string; cookies?: string[]; fetchSite?: string }) =>
  GET(new Request('https://powerguardian.cloud/sso/authorize?' + new URLSearchParams({ controller: o.controller ?? CTRL_A, nonce: nonce(), return: o.ret ?? RET_ROY }), {
    headers: { cookie: [o.session ? 'pg_session=' + o.session : '', ...(o.cookies ?? [])].filter(Boolean).join('; '), ...(o.fetchSite ? { 'sec-fetch-site': o.fetchSite } : {}) },
  }));
const silent = (r: Response, ret = RET_ROY) => r.status === 303 && (r.headers.get('location') ?? '').startsWith(ret + '?assertion=');
const continuePage = async (r: Response) => r.status === 200 && (await r.clone().text()).includes('id="sso-continue"');
async function decode(loc: string) {
  const token = decodeURIComponent(loc.split('assertion=')[1] ?? '');
  const dot = token.lastIndexOf('.'), msg = token.slice(0, dot), sig = token.slice(dot + 1);
  const unb = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(PUBKEY), (c) => c.charCodeAt(0)), { name: 'Ed25519' }, false, ['verify']);
  const ok = msg.startsWith(SSO_PREFIX) && await crypto.subtle.verify({ name: 'Ed25519' }, key, unb(sig), new TextEncoder().encode(msg));
  return ok ? JSON.parse(new TextDecoder().decode(unb(msg.slice(SSO_PREFIX.length)))) : null;
}

console.log('Open Console leaves a console intent');
const o1 = await openConsole(roy, 'site-roy');
const name = await intentCookieName('site-roy');
check('owner gets the console link', o1.status === 200 && !!o1.body.console_url, JSON.stringify(o1.body));
check('…and a console intent cookie named for that site', o1.pair.startsWith(name + '=') && name === `pg_ci_${await siteLabel('site-roy')}`, o1.setCookie);
check('…HttpOnly, Secure, SameSite=Lax, only for /sso/authorize, short-lived', /HttpOnly/.test(o1.setCookie) && /Secure/.test(o1.setCookie) && /SameSite=Lax/.test(o1.setCookie) && /Path=\/sso\/authorize/.test(o1.setCookie) && new RegExp(`Max-Age=${INTENT_TTL_S}\\b`).test(o1.setCookie) && INTENT_TTL_S <= 180, o1.setCookie);
check('…and the intent cookie never shows the session or the e-mail', !o1.setCookie.includes('roy@x.nl') && !o1.setCookie.includes(roy));
const oEve = await openConsole(eve, 'site-roy');
check('another account asking for that site: no link, no intent', oEve.status === 404 && !oEve.setCookie);

console.log('\nauthorize with the intent: completes without the Continue tap');
let r = await authorize({ session: roy, cookies: [o1.pair], fetchSite: 'same-site' });
check('owner, two-step session, own console host, fresh intent → straight back with a statement', silent(r), `${r.status} ${r.headers.get('location')}`);
const a = await decode(r.headers.get('location') ?? '');
check('the statement is the normal one (site, aud = console host, admin, mfa)', a?.site_id === 'site-roy' && a?.aud === `https://${await host('site-roy')}` && a?.role === 'admin' && a?.mfa === true && a?.exp - a?.iat === 60, JSON.stringify(a));
check('the intent cookie is cleared on the way', new RegExp(`${name}=;`).test(r.headers.get('set-cookie') ?? ''), r.headers.get('set-cookie') ?? '');
check('no referrer leaks the statement', r.headers.get('referrer-policy') === 'no-referrer');

console.log('\nnegative: no silent sign-in');
r = await authorize({ session: roy, cookies: [o1.pair] });
check('the same intent replayed → Continue page (single use)', await continuePage(r), String(r.status));
r = await authorize({ session: roy });
check('no intent (e.g. a later visit, or the site switcher) → Continue page', await continuePage(r));
const o2 = await openConsole(roy, 'site-roy');
r = await authorize({ session: royOther, cookies: [o2.pair] });
check('an intent made for another session of the same account → Continue page', await continuePage(r));
const o3 = await openConsole(roy, 'site-roy');
r = await authorize({ session: roy, controller: CTRL_A2, ret: RET_ROY2, cookies: [(await intentCookieName('site-roy2')) + '=' + o3.pair.split('=').slice(1).join('=')] });
check('an intent for site Acer moved to site HP\'s cookie → Continue page', await continuePage(r));
r = await authorize({ session: roy, controller: CTRL_A2, ret: RET_ROY2, cookies: [o3.pair] });
check('an intent for Acer while signing in to HP → Continue page', await continuePage(r));
r = await authorize({ session: roy, cookies: [o3.pair], fetchSite: 'cross-site' });
check('started from another site (Sec-Fetch-Site: cross-site) → Continue page', await continuePage(r));
const o4 = await openConsole(roy, 'site-roy');
r = await authorize({ session: roy, ret: RET_LAN, cookies: [o4.pair] });
check('an intent with a LAN return address → Continue page (silent only on the site\'s own console host)', await continuePage(r));
const old = await mintConsoleIntent('site-roy', roy, Date.now() - (INTENT_TTL_S + 5) * 1000);
r = await authorize({ session: roy, cookies: [old!.split(';')[0]] });
check('an expired intent → Continue page', await continuePage(r));
const forged = o4.pair.replace(/\.[^.]+$/, '.AAAA');
r = await authorize({ session: roy, cookies: [forged] });
check('an intent with a wrong signature → Continue page', await continuePage(r));
const o5 = await openConsole(royNoMfa, 'site-roy');
r = await authorize({ session: royNoMfa, cookies: [o5.pair] });
check('a session without two-step sign-in → Continue page (the controller then asks its own code)', await continuePage(r));
const o6 = await openConsole(roy, 'site-roy');
r = await authorize({ session: eve, cookies: [o6.pair] });
check('account B (eve) with a session and A\'s intent on A\'s console host → no access, no statement', r.status === 403 && !r.headers.get('location'));
const oe = await openConsole(eve, 'site-eve');
r = await authorize({ session: eve, cookies: [oe.pair.replace(await intentCookieName('site-eve'), name)] });
check('eve\'s own intent renamed to A\'s site → no access, no statement', r.status === 403 && !r.headers.get('location'));
r = await authorize({ cookies: [o6.pair] });
check('no cloud session → sign in first (login), never a statement', r.status === 303 && r.headers.get('location') === '/login?next=sso');
r = await authorize({ session: roy, cookies: [o6.pair] });
check('(control) the owner\'s untouched intent still works once', silent(r));

console.log('\nthe way back to the controller');
r = await authorize({ session: eve });
check('the no-access page links back to the controller sign-in without starting again (?sso=failed)', (await r.text()).includes(`https://${await host('site-roy')}/?sso=failed`));
r = await authorize({ session: roy });
check('the Continue page offers the controller\'s own sign-in instead', (await r.text()).includes(`https://${await host('site-roy')}/?sso=cancel`));
check('used intents are remembered only briefly (KV with a TTL)', [...kv.keys()].some((k) => k.startsWith('ci:used:')));

done();
