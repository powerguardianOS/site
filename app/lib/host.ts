// LOGIN-1: the site lives on ONE host, the apex. www is redirected there (middleware.ts) so the session cookie always
// sits on the same host, and every link we mail points at the apex directly.
export const APEX_HOST = 'powerguardian.cloud';
export const WWW_HOST = 'www.' + APEX_HOST;

// Base URL for links in mails. NEXT_PUBLIC_BASE_URL may still say www; that is rewritten to the apex. Local test
// setups (127.0.0.1 / localhost) are kept as they are.
export function siteBase(): string {
  const raw = (process.env.NEXT_PUBLIC_BASE_URL || `https://${APEX_HOST}`).replace(/\/+$/, '');
  try {
    const u = new URL(raw);
    if (u.hostname.toLowerCase() === WWW_HOST) return `https://${APEX_HOST}`;
    return u.origin;
  } catch {
    return `https://${APEX_HOST}`;
  }
}
