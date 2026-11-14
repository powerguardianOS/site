// SESSIONS-1: what "Sign-in & security" on the account page shows. Pure (tested without storage): records in, plain
// rows out. Never the session id, its hash, a full IP or a raw User-Agent.
import type { OwnSession } from '@/app/lib/session';
import { refOf } from '@/app/lib/session';
import type { ActivityEvent } from '@/app/lib/audit';
import { parseUserAgent, maskIp, placeLabel } from '@/app/lib/client-info';

export type SessionRow = {
  ref: string; current: boolean; device: string; browser: string; place: string; ip: string;
  created: number | null; seen: number | null; method: string;
};

export function methodText(s: Pick<OwnSession, 'method' | 'via' | 'mfa'>): string {
  if (!s.method) return s.mfa ? 'Two-step sign-in' : 'Signed in before this list existed';
  const first = s.method === 'code' ? 'Email code' : 'Email link';
  return s.via === 'recovery' ? `${first} + recovery code` : s.via === 'totp' || s.mfa ? `${first} + authenticator` : first;
}

export function sessionRows(list: OwnSession[], currentH: string): SessionRow[] {
  const rows = list.map((s) => {
    const d = parseUserAgent(s.ua ?? '');
    return {
      ref: refOf(s.h), current: !!currentH && s.h === currentH,
      device: s.ua ? d.device : 'Unknown device', browser: s.ua ? d.browser : '',
      place: placeLabel(s.country ?? '', s.city ?? ''), ip: maskIp(s.ip ?? ''),
      created: s.created ?? null, seen: s.seen ?? null, method: methodText(s),
    };
  });
  // this device first, then the most recently seen
  return rows.sort((a, b) => Number(b.current) - Number(a.current) || (b.seen ?? 0) - (a.seen ?? 0));
}

export type ActivityRow = { at: string; title: string; detail: string; where: string; warn: boolean };

const VIA: Record<string, string> = { portal: 'from your account', switcher: 'from the site switcher', share: 'shared access' };

export function activityRow(e: ActivityEvent): ActivityRow {
  const times = e.n && e.n > 1 ? ` (${e.n}×)` : '';
  const bySupport = e.by === 'support' ? ' by PowerGuardian support' : e.by === 'controller' ? ' by the controller' : '';
  let title = e.action, detail = '', warn = false;
  switch (e.action) {
    case 'auth.signin': title = 'Signed in'; detail = e.detail ?? ''; break;
    case 'auth.request': title = `Sign-in ${e.detail === 'code' ? 'code' : 'link'} requested${times}`; break;
    case 'auth.mfa_failed': title = `Wrong authenticator code${times}`; detail = e.detail === 'at sign-in' ? 'At sign-in' : 'On the account page'; warn = true; break;
    case 'auth.signout': title = 'Signed out'; break;
    case 'mfa.on': title = 'Two-step sign-in turned on'; break;
    case 'mfa.off': title = 'Two-step sign-in turned off'; warn = true; break;
    case 'mfa.recovery': title = 'New recovery codes made'; detail = 'The old ones stopped working'; break;
    case 'session.revoke': title = 'Signed out a device'; detail = e.detail ?? ''; break;
    case 'session.revoke_others': title = 'Signed out all other devices'; detail = e.detail ?? ''; break;
    case 'site.rename': title = `Site renamed${bySupport}`; detail = e.detail ?? ''; break;
    case 'site.claim': title = 'Licence claimed by a controller'; detail = e.detail ?? ''; break;
    case 'site.transfer': title = 'Licence moved to another controller'; detail = e.detail ?? ''; warn = true; break;
    case 'console.open': title = `Console opened${e.site ? ` · ${e.site}` : ''}`; detail = VIA[e.detail ?? ''] ?? ''; break;
  }
  const where = [e.device, e.place, e.ip].filter(Boolean).join(' · ');
  return { at: e.at, title, detail, where, warn };
}
