// B2 (review): a short mail to the account's own address whenever its sign-in security changes (a passkey added, the
// authenticator app turned on) or a passkey looked copied. Says what, from which device and place, and where to look.
// Sent after the change: a mail that fails is logged and never undoes or blocks it.
import { sendEmail } from '@/app/lib/email';
import { siteBase } from '@/app/lib/host';

export type SecurityEvent = 'passkey.add' | 'totp.on' | 'passkey.cloned';
const SUBJECT: Record<SecurityEvent, string> = {
  'passkey.add': 'A passkey was added to your PowerGuardian account',
  'totp.on': 'Two-step sign-in was turned on for your PowerGuardian account',
  'passkey.cloned': 'A passkey for your PowerGuardian account was refused',
};

export async function securityMail(email: string, kind: SecurityEvent, ctx: { name?: string; device?: string; place?: string; ip?: string } = {}): Promise<void> {
  const url = siteBase() + '/account';
  const what = kind === 'passkey.add' ? `Passkey: ${ctx.name || 'Passkey'}.`
    : kind === 'totp.on' ? 'An authenticator app now gives the second step.'
    : `"${ctx.name || 'Passkey'}" signed with a counter that went backwards, which can mean a copy of it. The sign-in was refused.`;
  const from = [ctx.device, ctx.place, ctx.ip].filter(Boolean).join(' · ');
  const text = `${what}${from ? `\nFrom: ${from}.` : ''}\n\n`
    + (kind === 'passkey.cloned'
      ? 'If you did not try to sign in, remove that passkey in Sign-in & security on your account page.'
      : 'If this was you, there is nothing to do. If not, open Sign-in & security on your account page, sign out the other devices and remove it.')
    + '\n\n' + url + '\n\n— PowerGuardian';
  try {
    await sendEmail(email, SUBJECT[kind], text, { heading: SUBJECT[kind], button: { label: 'Open Sign-in & security', url } });
  } catch (e) {
    console.error('[security-mail] not sent:', e instanceof Error ? e.message : 'error');
  }
}
