import type { Env } from './env.js';

export async function sendChatMessageReportEmail(input: {
  env: Env;
  subject: string;
  text: string;
}) {
  const { env, subject, text } = input;

  if (!env.RESEND_API_KEY) {
    throw Object.assign(new Error('Report email provider is not configured'), { statusCode: 500 });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.REPORT_EMAIL_FROM,
      to: [env.REPORT_EMAIL_TO],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw Object.assign(new Error(`Failed to send report email: ${response.status} ${bodyText}`.trim()), { statusCode: 500 });
  }
}
