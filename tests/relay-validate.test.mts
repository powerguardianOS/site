// The relay asks the site whether a controller token is valid (server-to-server, shared secret).
import { put, seed, lic, check, done, DAY } from './harness.mts';

process.env.RELAY_MINT_SECRET = 'shh-relay';
const { POST } = await import('../app/api/relay/validate/route.ts');
const call = (token: unknown, secret: string | null = 'shh-relay') =>
  POST(new Request('http://x/api/relay/validate', { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'X-Mint-Secret': secret } : {}) }, body: JSON.stringify({ token }) }) as any);
const j = async (r: Response) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }) as any;

const good = lic('L1', 'a@x.nl');
seed(good, lic('L2', 'b@x.nl', { status: 'revoked' }), lic('L3', 'c@x.nl', { expires_at: new Date(Date.now() - DAY).toISOString() }));
// rotated: old token still in the index, record carries the new one
const rot = lic('L4', 'd@x.nl'); const oldTok = 'old-' + 'f'.repeat(28);
seed(rot); put('index:token:' + oldTok, 'L4');

console.log('relay validate');
check('no secret: 401', (await j(await call(good.token, null))).status === 401);
check('wrong secret: 401', (await j(await call(good.token, 'nope'))).status === 401);
let r = await j(await call(good.token));
check('active licence, current token: valid + licence id', r.status === 200 && r.valid === true && r.license_id === 'L1');
check('unknown token: valid=false', (await j(await call('z'.repeat(32)))).valid === false);
check('revoked licence: valid=false', (await j(await call(lic('L2', 'b@x.nl').token))).valid === false);
check('expired licence: valid=false', (await j(await call(lic('L3', 'c@x.nl').token))).valid === false);
check('a rotated (old) token no longer opens the tunnel', (await j(await call(oldTok))).valid === false);
check('garbage input: valid=false, not a crash', (await j(await call(12345))).valid === false);
delete process.env.RELAY_MINT_SECRET;
check('relay secret not configured: fails closed (503)', (await j(await call(good.token))).status === 503);
done();
