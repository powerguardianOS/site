import { sendEmail } from '@/app/lib/email';

// Mails to the account owner about something that happened to his sites. A mail
// problem must never undo or block the action, so failures are only logged.
export async function notifyOwner(email: string, subject: string, text: string): Promise<void> {
  try {
    await sendEmail(email, subject, `${text}\n\nSee and manage your sites: https://powerguardian.cloud/account\nQuestions: sales@powerguardian.cloud\n\n— PowerGuardian`);
  } catch (e) {
    console.error('[notify] failed', e);
  }
}

export const dateLong = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
