import type { Env } from './env.js';

function formatFromAddress(email: string, name?: string) {
  const trimmedName = name?.trim();
  return trimmedName ? `${trimmedName} <${email}>` : email;
}

async function sendTransactionalEmail(input: {
  env: Env;
  to: string[];
  subject: string;
  text: string;
}) {
  const { env, to, subject, text } = input;

  if (!env.RESEND_API_KEY) {
    throw Object.assign(new Error('Report email provider is not configured'), { statusCode: 500 });
  }

  const primaryFrom = formatFromAddress(env.REPORT_EMAIL_FROM, env.REPORT_EMAIL_FROM_NAME);

  const send = async (from: string) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw Object.assign(new Error(`Failed to send transactional email: ${response.status} ${bodyText}`.trim()), {
        statusCode: 500,
      });
    }
  };

  try {
    await send(primaryFrom);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const needsFallback =
      env.REPORT_EMAIL_FROM !== 'onboarding@resend.dev' &&
      message.includes('domain is not verified');

    if (!needsFallback) throw error;

    await send(formatFromAddress('onboarding@resend.dev', env.REPORT_EMAIL_FROM_NAME));
  }
}

export async function sendChatMessageReportEmail(input: {
  env: Env;
  subject: string;
  text: string;
}) {
  const { env, subject, text } = input;
  await sendTransactionalEmail({
    env,
    to: [env.REPORT_EMAIL_TO],
    subject,
    text,
  });
}

export async function sendHostReviewReadyEmail(input: {
  env: Env;
  to: string;
  subject: string;
  text: string;
}) {
  const { env, to, subject, text } = input;
  await sendTransactionalEmail({
    env,
    to: [to],
    subject,
    text,
  });
}
