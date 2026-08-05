/**
 * GW → calendar month for monthly leaderboards / trophy cabinet (2025/26 career pile).
 * Same product buckets as mobile `leaderboardMonths` + BFF profile trophies.
 */

export type MonthAllocation = {
  monthKey: string;
  label: string;
  startGw: number;
  endGw: number;
};

/** Last scheduled GW of a standard PL campaign in the legacy schema. */
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

export function getMonthAllocations(): MonthAllocation[] {
  return SEASON_2025_26_MONTHS;
}
