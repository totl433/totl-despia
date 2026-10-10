/**
 * Pure helpers for batching simultaneous first-half kickoff notifications.
 */

/**
 * UTC minute bucket for simultaneous kickoffs (e.g. six 15:00 games).
 * Example: 2026-09-12T14:00:00.000Z → "20260912T1400"
 */
export function kickoffSlotKey(kickoffIso: string | null | undefined): string | null {
  if (!kickoffIso) return null;
  const ms = new Date(kickoffIso).getTime();
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}${mo}${day}T${h}${mi}`;
}

/**
 * Shared event_id for all first-half kickoffs in the same GW + kickoff minute.
 * Dedupes six 3pm pushes into one notification per user.
 */
export function buildKickoffSlotEventId(gw: number, slotKey: string, half: 1 | 2): string {
  return `kickoff:slot:${gw}:${slotKey}:${half}`;
}
