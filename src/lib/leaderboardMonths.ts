/**
 * GW → calendar month for monthly leaderboards / trophy cabinet.
 * A gameweek belongs to the month of its first fixture kickoff.
 * Keep these allocations in sync with the mobile app.
 */

export type MonthAllocation = {
  monthKey: string;
  label: string;
  startGw: number;
  endGw: number;
};

export type LeaderboardSeasonKey = '2025/26' | '2026/27';
export const SEASON_LAST_GW = 38;

/**
 * 2025/26 — first fixture of each GW (Premier League fixture list).
 * Aug 1–3 · Sep 4–7 · Oct 8–10 · Nov 11–13 · Dec 14–18 ·
 * Jan 19–22 · Feb 23–28 · Mar 29–31 · Apr 32–35 · May 36–38
 */
export const SEASON_2025_26_MONTHS: MonthAllocation[] = [
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
 * 2026/27 — season starts 21 August 2026 and ends 30 May 2027.
 * Aug 1–2 · Sep 3–5 · Oct 6–9 · Nov 10–12 · Dec 13–18 ·
 * Jan 19–23 · Feb 24–27 · Mar 28–30 · Apr 31–33 · May 34–38
 */
export const SEASON_2026_27_MONTHS: MonthAllocation[] = [
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

export type GwLiveStateForMonth = {
  hasActiveLiveGames?: boolean;
  isCurrentGwComplete?: boolean;
  hasGwKickoffStarted?: boolean;
};

export function resolveLeaderboardSeasonKey(input?: {
  seasonLabel?: string | null;
  isNewSeasonFresh?: boolean;
  useSeasonStack?: boolean;
}): LeaderboardSeasonKey {
  if (input?.isNewSeasonFresh) return '2026/27';
  const label = (input?.seasonLabel ?? '').trim();
  if (label === '2026/27' || label.startsWith('2026')) return '2026/27';
  if (input?.useSeasonStack && label.includes('2026')) return '2026/27';
  return '2025/26';
}

export function getMonthAllocations(
  seasonKey: LeaderboardSeasonKey = '2025/26'
): MonthAllocation[] {
  return seasonKey === '2026/27' ? SEASON_2026_27_MONTHS : SEASON_2025_26_MONTHS;
}

export function getMonthForGw(
  gw: number,
  seasonKey: LeaderboardSeasonKey = '2025/26'
): MonthAllocation | null {
  return getMonthAllocations(seasonKey).find(
    (month) => gw >= month.startGw && gw <= month.endGw
  ) ?? null;
}

export function isMonthAvailable(
  month: MonthAllocation,
  latestGw: number | null,
  gwLiveState: GwLiveStateForMonth | null | undefined,
  options?: { allowPreKickoffOpeningMonth?: boolean }
): boolean {
  if (latestGw == null) return false;
  if (latestGw > month.startGw) return true;
  if (latestGw < month.startGw) return false;
  if (options?.allowPreKickoffOpeningMonth) return true;
  return gwLiveState?.hasActiveLiveGames === true ||
    gwLiveState?.isCurrentGwComplete === true ||
    gwLiveState?.hasGwKickoffStarted === true;
}

export function getEffectiveCurrentMonthKey(
  latestGw: number | null,
  gwLiveState: GwLiveStateForMonth | null | undefined,
  seasonKey: LeaderboardSeasonKey = '2025/26',
  options?: { allowPreKickoffOpeningMonth?: boolean }
): string | null {
  if (!latestGw) return null;
  const months = getMonthAllocations(seasonKey);
  const currentMonth = getMonthForGw(latestGw, seasonKey);
  if (currentMonth && isMonthAvailable(currentMonth, latestGw, gwLiveState, options)) {
    return currentMonth.monthKey;
  }
  const available = months.filter((month) =>
    isMonthAvailable(month, latestGw, gwLiveState, options)
  );
  return available.at(-1)?.monthKey ?? null;
}
