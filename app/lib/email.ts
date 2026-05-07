export const runtime = 'edge';

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'PowerGuardian', email: 'noreply@powerguardian.cloud' },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });
}
