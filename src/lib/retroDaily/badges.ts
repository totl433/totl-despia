/** Badge path for RTD web cards. */
export function retroBadgeUrl(code: string): string {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw) return '';
  // Legacy / alt codes → file names in public/assets/badges
  const aliases: Record<string, string> = {
    BRI: 'BHA', // Brighton
  };
  const c = aliases[raw] ?? raw;
  return `/assets/badges/${c}.png`;
}
