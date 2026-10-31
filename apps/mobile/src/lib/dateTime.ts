/**
 * Date/time formatting helpers.
 *
 * IMPORTANT:
 * - Backend timestamps should be ISO strings with timezone (`Z` or an offset).
 * - We always *display* fixture times in the user's local timezone.
 * - We keep a consistent 24h clock for the UI (per spec).
 */

/** Countdown that always includes seconds — e.g. "2h 08m 05s". */
export function formatCountdownShort(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}h ${mm}m ${ss}s`;
  if (minutes > 0) return `${minutes}m ${ss}s`;
  return `${seconds}s`;
}

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

