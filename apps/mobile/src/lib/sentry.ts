export async function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  // Avoid crashing Expo Go if native Sentry isn't available.
  try {
    const Sentry = await import('@sentry/react-native');
    Sentry.init({
      dsn,
      enableAutoSessionTracking: true,
      enableNativeFramesTracking: true,
      tracesSampleRate: 0.2,
    });
  } catch {
    // Best-effort; ignore if unavailable.
  }
}

