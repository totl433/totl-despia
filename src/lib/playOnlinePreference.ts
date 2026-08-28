/**
 * Remembers "Play online" preference so the download-first landing
 * is skipped for a limited window (encourages returning to the app later).
 */

export const PLAY_ONLINE_COOKIE = 'totl_prefer_play_online';
export const PLAY_ONLINE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const APP_STORE_URL =
  'https://apps.apple.com/gb/app/totl-top-of-the-league/id6754661450';

export function prefersPlayOnline(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((part) => part.trim().startsWith(`${PLAY_ONLINE_COOKIE}=1`));
}

export function setPreferPlayOnline(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${PLAY_ONLINE_COOKIE}=1; path=/; max-age=${PLAY_ONLINE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearPreferPlayOnline(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${PLAY_ONLINE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
