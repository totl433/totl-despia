/** Display name / username length bounds (characters after trim). */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 18;

export function normalizeDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function hasSqlLikeWildcards(input: string): boolean {
  return input.includes('%') || input.includes('_');
}

/** Validate a display name. Returns a user-facing error, or null if ok. */
export function validateDisplayName(raw: string): string | null {
  const name = normalizeDisplayName(raw);
  if (!name) return 'Display name is required.';
  if (name.length < USERNAME_MIN_LENGTH) {
    return `Display name must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (name.length > USERNAME_MAX_LENGTH) {
    return `Display name must be at most ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (hasSqlLikeWildcards(name)) {
    return 'Display name contains invalid characters. Please remove % or _.';
  }
  return null;
}
