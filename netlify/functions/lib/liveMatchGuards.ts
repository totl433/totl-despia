/**
 * Guards against off-season / historical match re-processing.
 *
 * When app_meta.current_gw is accidentally reset, pollLiveScores can re-fetch
 * finished Football Data matches and live_scores upserts can re-fire goal pushes.
 */

/** Stop polling a match this long after kickoff (full time + injury buffer). */
export const MAX_LIVE_POLL_AFTER_KICKOFF_MS = 36 * 60 * 60 * 1000;

/** Never send live goal/kickoff/HT pushes this long after kickoff. */
export const MAX_NOTIFY_AFTER_KICKOFF_MS = 24 * 60 * 60 * 1000;

export function parseKickoffMs(kickoffIso: string | null | undefined): number | null {
  if (!kickoffIso) return null;
  const t = new Date(kickoffIso).getTime();
  return Number.isFinite(t) ? t : null;
}

export function isKickoffTooOldForPolling(
  kickoffIso: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const kickoffMs = parseKickoffMs(kickoffIso);
  if (kickoffMs === null) return false;
  return nowMs - kickoffMs > MAX_LIVE_POLL_AFTER_KICKOFF_MS;
}

export function isKickoffTooOldForLiveNotifications(
  kickoffIso: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  const kickoffMs = parseKickoffMs(kickoffIso);
  if (kickoffMs === null) return false;
  return nowMs - kickoffMs > MAX_NOTIFY_AFTER_KICKOFF_MS;
}

export function isTerminalMatchStatus(status: string | null | undefined): boolean {
  return status === 'FINISHED' || status === 'FT';
}

export function isLiveMatchStatus(status: string | null | undefined): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}
