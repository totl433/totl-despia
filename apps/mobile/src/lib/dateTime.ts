/**
 * Date/time formatting helpers.
 *
 * IMPORTANT:
 * - Backend timestamps should be ISO strings with timezone (`Z` or an offset).
 * - We always *display* fixture times in the user's local timezone.
 * - We keep a consistent 24h clock for the UI (per spec).
 */

export function formatLocalTimeHHmm(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  // Use device timezone by default; force 24h.
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatLocalDateShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function formatLocalDateTimeLabel(iso: string | null | undefined): string | null {
  const day = formatLocalDateShort(iso);
  if (!day) return null;
  const time = formatLocalTimeHHmm(iso);
  if (!time || time === '—') return null;
  return `${day} • ${time}`;
}

