import type { LiveScore } from '@totl/domain';

function updatedAtMs(row: LiveScore | undefined): number | null {
  const ms = typeof row?.updated_at === 'string' ? Date.parse(row.updated_at) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * True when `incoming` is an older copy of a row we already hold — a slow poll
 * response landing after a newer Realtime update. Rows without `updated_at` are
 * never treated as stale, so nothing is dropped when the timestamp is missing.
 */
export function isStaleLiveRow(current: LiveScore | undefined, incoming: LiveScore): boolean {
  const have = updatedAtMs(current);
  const got = updatedAtMs(incoming);
  return have !== null && got !== null && got < have;
}
