// REOPEN: a refresh (or a new tab) on a site's console host after its short console token expired. The relay sends
// such a page load to /console/reopen?site=<16 hex label>&path=<same-host path>; the signed-in owner gets a fresh
// console link for that site and lands back on the same page (app/console/reopen).

export const LABEL_RE = /^[0-9a-f]{16}$/;
export const REOPEN_NEXT_COOKIE = 'pg_reopen_next';
const PATH_MAX = 512;

// Same rule as the relay's safeReturnPath: a same-host relative path ("/x?y"), never "//host", "/\host", a scheme,
// whitespace or control characters, at most PATH_MAX long. Anything else is '/'.
export function safeConsolePath(p: unknown): string {
  if (typeof p !== 'string' || p.length > PATH_MAX) return '/';
  if (!/^\/(?![/\\])[^\\\s\x00-\x1f\x7f]*$/.test(p)) return '/';
  return p;
}

// The reopen URL to continue at after a sign-in (pg_reopen_next), or '' when the stored value is not a valid one.
export function reopenTarget(stored: string): string {
  let q: URLSearchParams;
  try { q = new URLSearchParams(stored); } catch { return ''; }
  const site = q.get('site') ?? '';
  if (!LABEL_RE.test(site)) return '';
  return '/console/reopen?' + new URLSearchParams({ site, path: safeConsolePath(q.get('path')) }).toString();
}
