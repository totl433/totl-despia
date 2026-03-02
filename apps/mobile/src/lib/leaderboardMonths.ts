/**
 * GW-to-month allocation for leaderboard Monthly tab.
 * TODO: Move to admin-configurable source (Supabase table + BFF API).
 * 2025/26 season mapping: GW assigned to month where first fixture of that GW kicks off.
 */
export type MonthKey = string; // e.g. "2025-08"

export interface MonthAllocation {
  monthKey: MonthKey;
  label: string; // e.g. "August 2025"
  startGw: number;
  endGw: number;
}

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

export function getMonthAllocations(): MonthAllocation[] {
  return SEASON_2025_26;
}

export function getMonthForGw(gw: number): MonthAllocation | null {
  return SEASON_2025_26.find((m) => gw >= m.startGw && gw <= m.endGw) ?? null;
}

export function getCurrentMonthKey(latestGw: number | null): MonthKey | null {
  if (!latestGw) return null;
  const m = getMonthForGw(latestGw);
  return m?.monthKey ?? null;
}

/**
 * A month is available when its first GW has gone LIVE or completed.
 * Used so e.g. March table only appears once GW29 (first GW of March) goes LIVE.
 */
export function isMonthAvailable(
  month: MonthAllocation,
  latestGw: number | null,
  gwLiveState: { hasActiveLiveGames?: boolean; isCurrentGwComplete?: boolean } | null | undefined
): boolean {
  if (latestGw == null) return false;
  if (latestGw > month.startGw) return true; // past first GW of month
  if (latestGw < month.startGw) return false; // future month
  // latestGw === month.startGw: available only when first kickoff has happened or GW is complete
  const hasLive = gwLiveState?.hasActiveLiveGames === true;
  const isComplete = gwLiveState?.isCurrentGwComplete === true;
  return hasLive || isComplete;
}

/**
 * Returns the month key to use as default when on monthly tab with no explicit selection.
 * Only returns a month that is available (first GW has gone LIVE or completed).
 */
export function getEffectiveCurrentMonthKey(
  latestGw: number | null,
  gwLiveState: { hasActiveLiveGames?: boolean; isCurrentGwComplete?: boolean } | null | undefined
): MonthKey | null {
  if (!latestGw) return null;
  const months = getMonthAllocations();
  const monthForGw = getMonthForGw(latestGw);
  if (monthForGw && isMonthAvailable(monthForGw, latestGw, gwLiveState)) return monthForGw.monthKey;
  // Fall back to most recent available month
  const available = months.filter((m) => isMonthAvailable(m, latestGw, gwLiveState));
  return available.length > 0 ? available[available.length - 1]!.monthKey : null;
}
