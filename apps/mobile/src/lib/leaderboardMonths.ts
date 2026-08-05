/**
 * GW-to-month allocation for leaderboard Monthly tab.
 *
 * Rule (same as product): each gameweek is assigned to the calendar month of the
 * **first fixture kickoff** of that GW (official PL fixture list).
 *
 * TODO: Move to admin-configurable source (Supabase table + BFF API).
 */

export type MonthKey = string; // e.g. "2025-08"

export interface MonthAllocation {
  monthKey: MonthKey;
  label: string; // e.g. "August 2025"
  startGw: number;
  endGw: number;
}

/** Which hard-coded season calendar to use for monthly tables. */
export type LeaderboardSeasonKey = '2025/26' | '2026/27';

/** Passed from GlobalScreen live GW query — used to decide if a month’s first GW has “started”. */
export type GwLiveStateForMonth = {
  hasActiveLiveGames?: boolean;
  isCurrentGwComplete?: boolean;
  hasGwKickoffStarted?: boolean;
};

/** Last scheduled gameweek of a standard PL season. */
export const SEASON_LAST_GW = 38;

/** Display label for the completed PL season that used GWs 1–38 in the current schema. */
export const SEASON_2025_26_LABEL = '2025/26';
export const SEASON_2025_26_START_GW = 1;
export const SEASON_2025_26_END_GW = SEASON_LAST_GW;

/** Upcoming / next PL season label (hard-switch welcome card + UI chrome). */
export const SEASON_2026_27_LABEL = '2026/27';

/**
 * 2025/26 — first fixture of each GW (Premier League fixture list).
 * Aug: GW1–3 · Sep: 4–7 · Oct: 8–10 · Nov: 11–13 · Dec: 14–18 ·
 * Jan: 19–22 · Feb: 23–28 · Mar: 29–31 · Apr: 32–35 · May: 36–38
 */
const SEASON_2025_26: MonthAllocation[] = [
  { monthKey: '2025-08', label: 'August 2025', startGw: 1, endGw: 3 },
  { monthKey: '2025-09', label: 'September 2025', startGw: 4, endGw: 7 },
  { monthKey: '2025-10', label: 'October 2025', startGw: 8, endGw: 10 },
  { monthKey: '2025-11', label: 'November 2025', startGw: 11, endGw: 13 },
  { monthKey: '2025-12', label: 'December 2025', startGw: 14, endGw: 18 },
  { monthKey: '2026-01', label: 'January 2026', startGw: 19, endGw: 22 },
  { monthKey: '2026-02', label: 'February 2026', startGw: 23, endGw: 28 },
  { monthKey: '2026-03', label: 'March 2026', startGw: 29, endGw: 31 },
  { monthKey: '2026-04', label: 'April 2026', startGw: 32, endGw: 35 },
  { monthKey: '2026-05', label: 'May 2026', startGw: 36, endGw: 38 },
];

/**
 * 2026/27 — first fixture of each GW (premierleague.com full list, released Jun 2026).
 * Season starts Fri 21 Aug 2026 (post–World Cup later start) and ends Sun 30 May 2027.
 *
 * Aug: GW1–2 (21–31 Aug) · Sep: 3–5 · Oct: 6–9 · Nov: 10–12 · Dec: 13–18 ·
 * Jan: 19–23 · Feb: 24–27 · Mar: 28–30 · Apr: 31–33 · May: 34–38
 */
const SEASON_2026_27: MonthAllocation[] = [
  { monthKey: '2026-08', label: 'August 2026', startGw: 1, endGw: 2 },
  { monthKey: '2026-09', label: 'September 2026', startGw: 3, endGw: 5 },
  { monthKey: '2026-10', label: 'October 2026', startGw: 6, endGw: 9 },
  { monthKey: '2026-11', label: 'November 2026', startGw: 10, endGw: 12 },
  { monthKey: '2026-12', label: 'December 2026', startGw: 13, endGw: 18 },
  { monthKey: '2027-01', label: 'January 2027', startGw: 19, endGw: 23 },
  { monthKey: '2027-02', label: 'February 2027', startGw: 24, endGw: 27 },
  { monthKey: '2027-03', label: 'March 2027', startGw: 28, endGw: 30 },
  { monthKey: '2027-04', label: 'April 2027', startGw: 31, endGw: 33 },
  { monthKey: '2027-05', label: 'May 2027', startGw: 34, endGw: 38 },
];

export function resolveLeaderboardSeasonKey(input?: {
  seasonLabel?: string | null;
  isNewSeasonFresh?: boolean;
  useSeasonStack?: boolean;
}): LeaderboardSeasonKey {
  if (input?.isNewSeasonFresh) return '2026/27';
  const label = (input?.seasonLabel ?? '').trim();
  if (label === SEASON_2026_27_LABEL || label.startsWith('2026')) return '2026/27';
  if (input?.useSeasonStack && label.includes('2026')) return '2026/27';
  return '2025/26';
}

export function getMonthAllocations(seasonKey: LeaderboardSeasonKey = '2025/26'): MonthAllocation[] {
  return seasonKey === '2026/27' ? SEASON_2026_27 : SEASON_2025_26;
}

export function getMonthForGw(
  gw: number,
  seasonKey: LeaderboardSeasonKey = '2025/26'
): MonthAllocation | null {
  return getMonthAllocations(seasonKey).find((m) => gw >= m.startGw && gw <= m.endGw) ?? null;
}

export function getCurrentMonthKey(
  latestGw: number | null,
  seasonKey: LeaderboardSeasonKey = '2025/26'
): MonthKey | null {
  if (!latestGw) return null;
  const m = getMonthForGw(latestGw, seasonKey);
  return m?.monthKey ?? null;
}

/**
 * A month is available when its first GW has gone LIVE or completed.
 * Used so e.g. March table only appears once GW29 (first GW of March) goes LIVE.
 *
 * Fresh season (pre first whistle): still show the opening month while viewing GW ≥ start,
 * so August is selectable with a zeroed table before kickoff.
 */
export function isMonthAvailable(
  month: MonthAllocation,
  latestGw: number | null,
  gwLiveState: GwLiveStateForMonth | null | undefined,
  options?: { allowPreKickoffOpeningMonth?: boolean }
): boolean {
  if (latestGw == null) return false;
  if (latestGw > month.startGw) return true; // past first GW of month
  if (latestGw < month.startGw) return false; // future month
  // latestGw === month.startGw
  if (options?.allowPreKickoffOpeningMonth) return true;
  const hasLive = gwLiveState?.hasActiveLiveGames === true;
  const isComplete = gwLiveState?.isCurrentGwComplete === true;
  const kickoffStarted = gwLiveState?.hasGwKickoffStarted === true;
  return hasLive || isComplete || kickoffStarted;
}

/**
 * Returns the month key to use as default when on monthly tab with no explicit selection.
 * Only returns a month that is available (first GW has gone LIVE or completed), except
 * early-season pre-kickoff when we allow the opening month.
 */
export function getEffectiveCurrentMonthKey(
  latestGw: number | null,
  gwLiveState: GwLiveStateForMonth | null | undefined,
  seasonKey: LeaderboardSeasonKey = '2025/26',
  options?: { allowPreKickoffOpeningMonth?: boolean }
): MonthKey | null {
  if (!latestGw) return null;
  const months = getMonthAllocations(seasonKey);
  const monthForGw = getMonthForGw(latestGw, seasonKey);
  if (monthForGw && isMonthAvailable(monthForGw, latestGw, gwLiveState, options)) {
    return monthForGw.monthKey;
  }
  const available = months.filter((m) => isMonthAvailable(m, latestGw, gwLiveState, options));
  return available.length > 0 ? available[available.length - 1]!.monthKey : null;
}
