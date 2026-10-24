import { computeGwTableRows, type LeagueScoringPick, type LeagueScoringResultRow } from './leagueScoring';
import { buildOpeningFixtureIndexByGw } from './openingFixture';
import { shouldIncludeGwForLeague, type LeagueStartOptions } from './leagueStart';

export type OpeningUnicornEvent = {
  leagueId: string;
  leagueName: string;
  gw: number;
  userId: string;
  wonGw: boolean;
  openingFixtureIndex: number;
};

export type OpeningUnicornWinRateResult = {
  winRatePercent: number | null;
  wins: number;
  total: number;
  events: OpeningUnicornEvent[];
};

type LeagueInput = {
  id: string;
  name: string;
  created_at?: string | null;
  start_gw?: number | null;
};

type MemberInput = { league_id: string; user_id: string };

/**
 * Aggregate win rate when a player scores a unicorn on the gameweek's opening fixture,
 * across all mini-league × gameweek instances (3+ members, league start rules applied).
 */
export function computeOpeningUnicornWinRate(params: {
  leagues: LeagueInput[];
  members: MemberInput[];
  fixtures: Array<{ gw: number; fixture_index: number; kickoff_time: string | null | undefined }>;
  picks: LeagueScoringPick[];
  results: LeagueScoringResultRow[];
  gwDeadlines: Map<number, Date>;
  leagueStartOptions?: LeagueStartOptions;
  skipLeagueNames?: Set<string>;
}): OpeningUnicornWinRateResult {
  const {
    leagues,
    members,
    fixtures,
    picks,
    results,
    gwDeadlines,
    leagueStartOptions,
    skipLeagueNames = new Set(['API Test']),
  } = params;

  const openingByGw = buildOpeningFixtureIndexByGw(fixtures);
  const gwsWithOpening = [...openingByGw.keys()].sort((a, b) => a - b);

  const membersByLeague = new Map<string, string[]>();
  members.forEach((m) => {
    const arr = membersByLeague.get(m.league_id) ?? [];
    arr.push(m.user_id);
    membersByLeague.set(m.league_id, arr);
  });

  const resultsByGwIdx = new Map<string, LeagueScoringResultRow>();
  results.forEach((r) => {
    if (r.gw == null || r.fixture_index == null) return;
    resultsByGwIdx.set(`${r.gw}:${r.fixture_index}`, r);
  });

  const events: OpeningUnicornEvent[] = [];

  for (const league of leagues) {
    if (skipLeagueNames.has(league.name)) continue;
    const memberIds = membersByLeague.get(league.id) ?? [];
    if (memberIds.length < 3) continue;

    const scoringMembers = memberIds.map((id) => ({ id, name: id }));

    for (const gw of gwsWithOpening) {
      if (
        !shouldIncludeGwForLeague(league, gw, gwDeadlines, leagueStartOptions)
      ) {
        continue;
      }

      const openingFixtureIndex = openingByGw.get(gw);
      if (openingFixtureIndex === undefined) continue;

      const gwResults = results.filter((r) => r.gw === gw);
      if (gwResults.length === 0) continue;

      const gwPicks = picks.filter(
        (p) => p.gw === gw && memberIds.includes(p.user_id)
      );
      if (gwPicks.length === 0) continue;

      const rows = computeGwTableRows({
        members: scoringMembers,
        picks: gwPicks,
        results: gwResults,
        liveScores: {},
        resGw: gw,
        currentGw: null,
        isApiTestLeague: false,
        currentTestGw: null,
      });

      if (rows.length === 0) continue;

      const top = rows[0]!;
      const coTop = rows.filter(
        (r) => r.score === top.score && r.unicorns === top.unicorns
      );
      const winners = new Set(coTop.map((r) => r.user_id));

      const key = `${gw}:${openingFixtureIndex}`;
      const resultRow = resultsByGwIdx.get(key);
      if (!resultRow) continue;

      const fixturePicks = gwPicks.filter((p) => p.fixture_index === openingFixtureIndex);
      const outcome =
        resultRow.result ??
        (typeof resultRow.home_goals === 'number' &&
        typeof resultRow.away_goals === 'number'
          ? resultRow.home_goals > resultRow.away_goals
            ? 'H'
            : resultRow.home_goals < resultRow.away_goals
              ? 'A'
              : 'D'
          : null);
      if (outcome !== 'H' && outcome !== 'D' && outcome !== 'A') continue;

      const correctUsers = fixturePicks
        .filter((p) => p.pick === outcome)
        .map((p) => p.user_id);

      if (correctUsers.length !== 1) continue;

      const unicornUserId = correctUsers[0]!;

      events.push({
        leagueId: league.id,
        leagueName: league.name,
        gw,
        userId: unicornUserId,
        wonGw: winners.has(unicornUserId),
        openingFixtureIndex,
      });
    }
  }

  const wins = events.filter((e) => e.wonGw).length;
  const total = events.length;
  const winRatePercent =
    total > 0 ? Math.round((wins / total) * 10000) / 100 : null;

  return { winRatePercent, wins, total, events };
}

/** Build gw -> deadline (first kickoff − 75 min) from fixtures. */
export function buildGwDeadlinesFromFixtures(
  fixtures: Array<{ gw: number; kickoff_time: string | null | undefined }>
): Map<number, Date> {
  const firstKickoffByGw = new Map<number, string>();
  fixtures.forEach((f) => {
    if (!f.kickoff_time) return;
    if (!firstKickoffByGw.has(f.gw)) firstKickoffByGw.set(f.gw, f.kickoff_time);
  });

  const deadlines = new Map<number, Date>();
  firstKickoffByGw.forEach((kickoff, gw) => {
    const first = new Date(kickoff);
    if (Number.isNaN(first.getTime())) return;
    deadlines.set(gw, new Date(first.getTime() - 75 * 60 * 1000));
  });
  return deadlines;
}
