/** Badge path for RTD web cards. */
export function retroBadgeUrl(code: string): string {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return '';
  return `/assets/badges/${c}.png`;
}
