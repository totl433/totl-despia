/**
 * Client dual-stack table map for direct Supabase reads.
 * Mirrors BFF seasonStack table names (incl. points views).
 */
export type PileTables = {
  fixtures: string;
  picks: string;
  results: string;
  submissions: string;
  gwPoints: string;
  ocpOverall: string;
};

export const LEGACY_PILE_TABLES: PileTables = {
  fixtures: 'app_fixtures',
  picks: 'app_picks',
  results: 'app_gw_results',
  submissions: 'app_gw_submissions',
  gwPoints: 'app_v_gw_points',
  ocpOverall: 'app_v_ocp_overall',
};

export const SEASON_PILE_TABLES: PileTables = {
  fixtures: 'app_season_fixtures',
  picks: 'app_season_picks',
  results: 'app_season_results',
  submissions: 'app_season_submissions',
  gwPoints: 'app_v_season_gw_points',
  ocpOverall: 'app_v_season_ocp_overall',
};

/** True when reads should hit Pile B (folder-aware) for the selected season year. */
export function resolveLeaguePileTables(input: {
  useSeasonStack: boolean;
  seasonId: string | null;
  /** Viewing archived 2025/26 while flag is on for 2026/27 → use legacy pile. */
  viewingArchive2025_26: boolean;
}): { tables: PileTables; seasonIdFilter: string | null } {
  if (input.viewingArchive2025_26) {
    return { tables: LEGACY_PILE_TABLES, seasonIdFilter: null };
  }
  if (input.useSeasonStack && input.seasonId) {
    return { tables: SEASON_PILE_TABLES, seasonIdFilter: input.seasonId };
  }
  return { tables: LEGACY_PILE_TABLES, seasonIdFilter: null };
}
