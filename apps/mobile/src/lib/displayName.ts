export function normalizeDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function hasSqlLikeWildcards(input: string): boolean {
  return input.includes('%') || input.includes('_');
}
