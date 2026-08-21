/**
 * Premier League kickoff display — always UK local (BST/GMT), not UTC wall
 * and not the browser's local timezone.
 */

export const UK_TIMEZONE = 'Europe/London';

export function formatKickoffTimeUk(
  iso: string | null | undefined,
  options?: { hour12?: boolean }
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: options?.hour12 ?? false,
  }).format(d);
}

export function formatKickoffDateUk(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

/** Combined "Fri 21 Aug · 20:00" label when both needed */
export function formatKickoffLabelUk(iso: string | null | undefined): string {
  if (!iso) return 'TBC';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBC';
  const date = formatKickoffDateUk(iso);
  const time = formatKickoffTimeUk(iso);
  return date && time ? `${date} ${time}` : date || time || 'TBC';
}
