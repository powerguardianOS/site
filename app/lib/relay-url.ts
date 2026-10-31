// Base URL of the relay worker. RELAY_BASE_URL overrides it for local tests only;
// unset in production.
export function relayBase(): string {
  const o = (process.env.RELAY_BASE_URL ?? '').replace(/\/+$/, '');
  return o || 'https://relay.powerguardian.cloud';
}
