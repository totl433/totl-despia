/**
 * Live GW scoring — same rules as `GET /v1/leaderboards/gw/:gw/live`.
 * Used by profile stats so aggregates match leaderboards through the current GW.
 */

async function fetchAllRowsForGwList<T>(
  supa: any,
  table: string,
  select: string,
  gwIds: number[],
  orderPrimary: string,
  orderSecondary?: string,
  orderTertiary?: string
): Promise<T[]> {
  if (!gwIds.length) return [];
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const to = from + 999;
    let q = (supa as any).from(table).select(select).in('gw', gwIds).order(orderPrimary, { ascending: true }).range(from, to);
    if (orderSecondary) q = q.order(orderSecondary, { ascending: true });
    if (orderTertiary) q = q.order(orderTertiary, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export type GwLiveScorePack = {
  scores: Array<{ user_id: string; score: number }>;
  /** Same rule as Global GW leaderboard: every fixture in `app_fixtures` has a merged outcome. */
  leaderboardComplete: boolean;
};

function buildScoresForSingleGw(
  gw: number,
  submissionsRows: Array<{ user_id?: string; gw?: number }>,
  picksRows: Array<{ user_id?: string; gw?: number; fixture_index?: number; pick?: string | null }>,
  liveScoresRows: Array<{
    gw?: number;
    api_match_id?: number | null;
    fixture_index?: number | null;
    home_score?: number | null;
    away_score?: number | null;
    status?: string | null;
  }>,
  resultsRows: Array<{ gw?: number; fixture_index?: number; result?: string | null }>,
  fixturesRows: Array<{ gw?: number; fixture_index?: number; api_match_id?: number | null }>
): GwLiveScorePack {
  const picks = picksRows
    .filter((p) => Number(p.gw) === gw)
    .filter((p: any) => p.pick === 'H' || p.pick === 'D' || p.pick === 'A');

  const submittedIds = new Set<string>([
    ...submissionsRows.filter((s) => Number(s.gw) === gw).map((s: any) => String(s.user_id)),
    ...picks.map((p: any) => String(p.user_id)),
  ]);

  if (!submittedIds.size) return { scores: [], leaderboardComplete: false };

  const outcomeByFixtureIndex = new Map<number, 'H' | 'D' | 'A'>();
  resultsRows
    .filter((r) => Number(r.gw) === gw)
    .forEach((r: any) => {
      if (r.result === 'H' || r.result === 'D' || r.result === 'A')
        outcomeByFixtureIndex.set(Number(r.fixture_index), r.result);
    });

  const fixtures = fixturesRows.filter((f) => Number(f.gw) === gw);
  const apiMatchIdToFixtureIndex = new Map<number, number>();
  fixtures.forEach((f: any) => {
    if (typeof f.api_match_id === 'number') apiMatchIdToFixtureIndex.set(f.api_match_id, f.fixture_index);
  });

  liveScoresRows
    .filter((ls) => Number(ls.gw) === gw)
    .forEach((ls: any) => {
      const status = ls.status;
      const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
      if (!started) return;
      const fixtureIndex =
        typeof ls.fixture_index === 'number'
          ? ls.fixture_index
          : typeof ls.api_match_id === 'number'
            ? apiMatchIdToFixtureIndex.get(ls.api_match_id)
            : undefined;
      if (fixtureIndex === undefined) return;
      const hs = Number(ls.home_score ?? 0);
      const as = Number(ls.away_score ?? 0);
      const out: 'H' | 'D' | 'A' = hs > as ? 'H' : hs < as ? 'A' : 'D';
      outcomeByFixtureIndex.set(fixtureIndex, out);
    });

  const picksByFixtureIndex = new Map<number, Array<{ user_id: string; pick: 'H' | 'D' | 'A' }>>();
  picks.forEach((p: any) => {
    if (!submittedIds.has(String(p.user_id))) return;
    const fi = Number(p.fixture_index);
    const arr = picksByFixtureIndex.get(fi) ?? [];
    arr.push({ user_id: String(p.user_id), pick: p.pick });
    picksByFixtureIndex.set(fi, arr);
  });

  const scores = new Map<string, number>();
  submittedIds.forEach((uid) => scores.set(uid, 0));

  outcomeByFixtureIndex.forEach((outcome, fixtureIndex) => {
    const thesePicks = picksByFixtureIndex.get(fixtureIndex) ?? [];
    thesePicks.forEach((p) => {
      if (p.pick !== outcome) return;
      scores.set(p.user_id, (scores.get(p.user_id) ?? 0) + 1);
    });
  });

  const leaderboardComplete =
    fixtures.length > 0 &&
    fixtures.every((f: any) => typeof f.fixture_index === 'number' && outcomeByFixtureIndex.has(Number(f.fixture_index)));

  return {
    scores: Array.from(scores.entries()).map(([user_id, score]) => ({ user_id, score })),
    leaderboardComplete,
  };
}

/** Competition rank for one user (1 = best); ties share the same rank. */
export function rankUserInGwLiveScores(
  userId: string,
  rows: Array<{ user_id: string; score: number }>
): number | null {
  if (!rows.length) return null;
  const uid = String(userId).toLowerCase();
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.user_id.localeCompare(b.user_id));
  let currentRank = 1;
  for (let idx = 0; idx < sorted.length; idx++) {
    const p = sorted[idx]!;
    if (idx > 0 && sorted[idx - 1]!.score !== p.score) currentRank = idx + 1;
    if (String(p.user_id).toLowerCase() === uid) return currentRank;
  }
  return null;
}

/**
 * Same scoring as repeated `computeLiveGwScoresForGw`, but one paginated fetch per table.
 * Use for trophy math so ranks match the Global GW leaderboard (`app_v_gw_points` alone can lag live merges).
 */
export async function computeLiveGwScoresForGwsBatch(
  supa: any,
  gws: number[]
): Promise<Map<number, GwLiveScorePack>> {
  const uniq = [...new Set(gws.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
  const out = new Map<number, GwLiveScorePack>();
  if (!uniq.length) return out;

  const [submissionsAll, picksAll, liveAll, resultsAll, fixturesAll] = await Promise.all([
    fetchAllRowsForGwList<{ user_id: string; gw: number }>(
      supa,
      'app_gw_submissions',
      'user_id, gw',
      uniq,
      'gw',
      'user_id'
    ),
    fetchAllRowsForGwList<{ user_id: string; gw: number; fixture_index: number; pick: string | null }>(
      supa,
      'app_picks',
      'user_id, gw, fixture_index, pick',
      uniq,
      'gw',
      'fixture_index',
      'user_id'
    ),
    fetchAllRowsForGwList(supa, 'live_scores', 'gw, api_match_id, fixture_index, home_score, away_score, status', uniq, 'gw'),
    fetchAllRowsForGwList(supa, 'app_gw_results', 'gw, fixture_index, result', uniq, 'gw', 'fixture_index'),
    fetchAllRowsForGwList(supa, 'app_fixtures', 'gw, fixture_index, api_match_id', uniq, 'gw', 'fixture_index'),
  ]);

  for (const gw of uniq) {
    out.set(gw, buildScoresForSingleGw(gw, submissionsAll, picksAll, liveAll as any, resultsAll as any, fixturesAll as any));
  }

  return out;
}

export async function computeLiveGwScoresForGw(
  supa: any,
  gw: number
): Promise<Array<{ user_id: string; score: number }>> {
  const m = await computeLiveGwScoresForGwsBatch(supa, [gw]);
  return m.get(gw)?.scores ?? [];
}
