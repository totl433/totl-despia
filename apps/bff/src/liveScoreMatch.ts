/** `live_scores` is keyed by gw only. Last season's GW8 must not score this season's GW8. */

function apiId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function liveScoreBelongsToFixture(
  fixture: { api_match_id?: number | null; kickoff_time?: string | null },
  row: { api_match_id?: number | null; kickoff_time?: string | null }
): boolean {
  const fixtureApi = apiId(fixture.api_match_id);
  const rowApi = apiId(row.api_match_id);
  if (fixtureApi != null) return rowApi === fixtureApi;
  const fixtureKo = fixture.kickoff_time ? Date.parse(fixture.kickoff_time) : NaN;
  const rowKo = row.kickoff_time ? Date.parse(row.kickoff_time) : NaN;
  if (Number.isFinite(fixtureKo) && Number.isFinite(rowKo)) {
    return Math.abs(fixtureKo - rowKo) <= 3 * 60 * 60 * 1000;
  }
  return true;
}

export function liveScoresForFixtures<T extends { api_match_id?: number | null; fixture_index?: number | null; kickoff_time?: string | null }>(
  fixtures: Array<{ api_match_id?: number | null; fixture_index?: number | null; kickoff_time?: string | null }>,
  rows: T[]
): T[] {
  return rows.filter((row) => fixtures.some((fixture) => liveScoreBelongsToFixture(fixture, row)));
}
