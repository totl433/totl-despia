import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
  });
}

export function captureException(err: unknown) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(err);
}

