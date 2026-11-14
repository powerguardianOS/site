// Re-exports for tests/mfa.test.mts plus a statement decoder that checks it the way the controller does.
export * from '../app/lib/mfa.ts';
import { SSO_PREFIX } from '../app/lib/sso.ts';

const unb = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

export const SSO = {
  async decode(token: string, pubB64: string): Promise<Record<string, unknown> | null> {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const msg = token.slice(0, dot), sig = token.slice(dot + 1);
    const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(pubB64), (c) => c.charCodeAt(0)), { name: 'Ed25519' }, false, ['verify']);
    const ok = msg.startsWith(SSO_PREFIX) && await crypto.subtle.verify({ name: 'Ed25519' }, key, unb(sig), new TextEncoder().encode(msg));
    return ok ? JSON.parse(new TextDecoder().decode(unb(msg.slice(SSO_PREFIX.length)))) : null;
  },
};
