// Relay base URL: default is the live relay, RELAY_BASE_URL overrides it (local tests only).
import { check, done } from './harness.mts';
const { relayBase } = await import('../app/lib/relay-url.ts');
delete process.env.RELAY_BASE_URL;
check('default is the live relay', relayBase() === 'https://relay.powerguardian.cloud');
process.env.RELAY_BASE_URL = 'http://127.0.0.1:8787/';
check('override, trailing slash trimmed', relayBase() === 'http://127.0.0.1:8787');
done();
