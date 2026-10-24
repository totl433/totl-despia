import type { Fixture, LiveScore } from '@totl/domain';

function updatedAtMs(row: LiveScore | undefined): number | null {
  const ms = typeof row?.updated_at === 'string' ? Date.parse(row.updated_at) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

function apiId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * `live_scores` is still keyed by gw only. Last season's GW8 rows must not
 * attach to this season's GW8 fixtures just because the index matches.
 */
export function liveScoreBelongsToFixture(
  fixture: Pick<Fixture, 'api_match_id' | 'kickoff_time'>,
  row: Pick<LiveScore, 'api_match_id' | 'kickoff_time'>
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

/** Prefer the Football Data match id. Never fall back to another match at the same index. */
export function resolveLiveScore(
  fixture: Fixture,
  liveByFixtureIndex: Map<number, LiveScore>,
  liveByApiMatchId?: Map<number, LiveScore>
): LiveScore | undefined {
  const fixtureApi = apiId(fixture.api_match_id);
  if (fixtureApi != null) {
    const byId = liveByApiMatchId?.get(fixtureApi);
    if (byId) return liveScoreBelongsToFixture(fixture, byId) ? byId : undefined;
  }
  const idx = Number(fixture.fixture_index);
  if (!Number.isInteger(idx)) return undefined;
  const row = liveByFixtureIndex.get(idx);
  return row && liveScoreBelongsToFixture(fixture, row) ? row : undefined;
}

export function indexLiveScoresByFixture(fixtures: Fixture[], rows: Iterable<LiveScore>): Map<number, LiveScore> {
  const byApi = new Map<number, LiveScore>();
  const byIndex = new Map<number, LiveScore>();
  for (const row of rows) {
    const id = apiId(row.api_match_id);
    if (id != null) byApi.set(id, row);
    const idx = Number(row.fixture_index);
    if (Number.isInteger(idx) && idx >= 0) byIndex.set(idx, row);
  }
  const out = new Map<number, LiveScore>();
  for (const fixture of fixtures) {
    const row = resolveLiveScore(fixture, byIndex, byApi);
    if (row) out.set(fixture.fixture_index, row);
  }
  return out;
}

/**
 * True when `incoming` is an older copy of a row we already hold — a slow poll
 * response landing after a newer Realtime update. Rows without `updated_at` are
 * never treated as stale, so nothing is dropped when the timestamp is missing.
 */
export function isStaleLiveRow(current: LiveScore | undefined, incoming: LiveScore): boolean {
  const have = updatedAtMs(current);
  const got = updatedAtMs(incoming);
  return have !== null && got !== null && got < have;
}
