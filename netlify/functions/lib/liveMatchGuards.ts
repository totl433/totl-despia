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

/**
 * Football Data sometimes returns TIMED/SCHEDULED mid-match (empty scores).
 * Once we have stored IN_PLAY or PAUSED, ignore those regressions so the UI
 * does not snap back to "not started". Still accept PAUSED, IN_PLAY, FINISHED, etc.
 */
export function shouldIgnoreTimedStatusRegression(
  previousStatus: string | null | undefined,
  incomingStatus: string | null | undefined
): boolean {
  if (!isLiveMatchStatus(previousStatus)) return false;
  return incomingStatus === 'TIMED' || incomingStatus === 'SCHEDULED';
}

export type LiveGoalEvent = {
  minute?: number | null;
  scorer?: string | null;
  team?: string | null;
  teamId?: number | null;
  isOwnGoal?: boolean;
  [key: string]: unknown;
};

function normalizeTeamKey(name: string | null | undefined): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * FD can briefly include a scorer in `goals` before `score` catches up
 * (or leave a disallowed goal in the list after the score drops).
 * Cap goal events to the current score so the UI never shows "Williams 66'"
 * under a 0-0.
 */
export function alignGoalsToMatchScore<T extends LiveGoalEvent>(
  goals: T[] | null | undefined,
  homeScore: number,
  awayScore: number,
  homeTeamName?: string | null,
  awayTeamName?: string | null
): T[] | null {
  if (!goals || goals.length === 0) return null;

  const homeNeed = Math.max(0, Number(homeScore) || 0);
  const awayNeed = Math.max(0, Number(awayScore) || 0);
  const totalNeed = homeNeed + awayNeed;
  if (totalNeed === 0) return null;

  const homeKey = normalizeTeamKey(homeTeamName);
  const awayKey = normalizeTeamKey(awayTeamName);
  const byMinute = (a: T, b: T) => (a.minute ?? 0) - (b.minute ?? 0);

  const home: T[] = [];
  const away: T[] = [];
  const unmatched: T[] = [];

  for (const goal of goals) {
    const key = normalizeTeamKey(goal.team);
    // Prefer exact key match; also allow short canonical names ("Forest")
    // contained in longer API names ("nottinghamforest").
    const matchesHome =
      !!homeKey &&
      !!key &&
      (key === homeKey || key.includes(homeKey) || homeKey.includes(key));
    const matchesAway =
      !!awayKey &&
      !!key &&
      (key === awayKey || key.includes(awayKey) || awayKey.includes(key));

    if (matchesHome && !matchesAway) home.push(goal);
    else if (matchesAway && !matchesHome) away.push(goal);
    else unmatched.push(goal);
  }

  home.sort(byMinute);
  away.sort(byMinute);
  unmatched.sort(byMinute);

  // Always cap per side — even when total counts look fine — so a home
  // scorer cannot sit under a 0-x scoreline.
  const keptHome = home.slice(0, homeNeed);
  const keptAway = away.slice(0, awayNeed);
  let homeSlots = homeNeed - keptHome.length;
  let awaySlots = awayNeed - keptAway.length;

  // Only unmatched events may fill empty slots (never steal a clearly
  // attributed home goal onto the away side).
  for (const goal of unmatched) {
    if (homeSlots > 0) {
      keptHome.push(goal);
      homeSlots--;
    } else if (awaySlots > 0) {
      keptAway.push(goal);
      awaySlots--;
    }
  }

  const kept = [...keptHome, ...keptAway].sort(byMinute);
  return kept.length > 0 ? kept : null;
}

export function shouldRunScheduledPollForSite(siteUrl: string | null | undefined): boolean {
  if (!siteUrl) return true;

  try {
    const hostname = new URL(siteUrl).hostname.toLowerCase();
    return hostname === 'playtotl.com' || hostname === 'www.playtotl.com';
  } catch {
    return false;
  }
}
