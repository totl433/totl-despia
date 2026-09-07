export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase().replace(/@googlemail\.com$/, '@gmail.com');
}

export function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'That email or password is incorrect. Please check both and try again.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirm your email address before signing in.';
  }
  if (normalized.includes('timed out') || normalized.includes('network') || normalized.includes('fetch')) {
    return 'We couldn’t reach the sign-in service. Check your connection and try again.';
  }
  return message || 'Something went wrong. Please try again.';
}

