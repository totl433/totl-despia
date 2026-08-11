export type FinalSubmissionScope = {
  table: 'app_gw_submissions' | 'app_season_submissions';
  seasonId: string | null;
};

export function resolveFinalSubmissionScope(seasonId: unknown): FinalSubmissionScope {
  const normalizedSeasonId = typeof seasonId === 'string' ? seasonId.trim() : '';
  return normalizedSeasonId
    ? { table: 'app_season_submissions', seasonId: normalizedSeasonId }
    : { table: 'app_gw_submissions', seasonId: null };
}

export function buildFinalSubmissionEventId(
  leagueId: string,
  gw: number,
  seasonId: string | null
): string {
  return `final_sub:${leagueId}:${seasonId ?? 'legacy'}:${gw}`;
}
