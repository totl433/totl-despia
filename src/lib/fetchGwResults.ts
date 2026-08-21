import { supabase } from './supabase';
import { calculateLastGwRank, calculateFormRank, calculateSeasonRank } from './helpers';
import { ensureActiveSeasonCtx } from './activeSeasonCtx';
import { getSeasonTables, withSeasonId, type SeasonCtx, type SeasonTables } from './seasonStack';
import { fetchAllGwPoints, fetchOverallOcp } from './fetchAllGwPoints';

export interface GwResults {
  score: number;
  totalFixtures: number;
  gwRank: number | null;
  gwRankTotal: number | null;
  trophies: {
    gw: boolean;
    form5: boolean;
    form10: boolean;
    overall: boolean;
  };
  mlVictories: number;
  mlVictoryNames: string[];
  mlVictoryData: Array<{ id: string; name: string; avatar: string | null }>;
  leaderboardChanges: {
    overall: { before: number | null; after: number | null; change: number | null };
    form5: { before: number | null; after: number | null; change: number | null };
    form10: { before: number | null; after: number | null; change: number | null };
  };
}

type PointsRow = { user_id: string; gw: number; points: number };
type OcpRow = { user_id: string; name: string | null; ocp: number };

async function queryGwPointsForGw(
  tables: SeasonTables,
  seasonCtx: SeasonCtx,
  gw: number
): Promise<Array<{ user_id: string; points: number }>> {
  let q = (supabase as any)
    .from(tables.gwPoints)
    .select('user_id, points')
    .eq('gw', gw);
  if (seasonCtx.useSeasonStack && seasonCtx.seasonId) {
    q = q.eq('season_id', seasonCtx.seasonId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    user_id: p.user_id as string,
    points: p.points || 0,
  }));
}

/**
 * Fetches all data needed for the Gameweek Results Modal.
 * Season-aware: Pile B uses app_season_* / app_v_season_* (never last-year GW # from legacy).
 */
export async function fetchGwResults(userId: string, gw: number): Promise<GwResults> {
  const seasonCtx = await ensureActiveSeasonCtx(supabase as any, userId);
  const tables = getSeasonTables(seasonCtx);
  const seasonId = seasonCtx.useSeasonStack ? seasonCtx.seasonId : null;

  // 1. Get GW score and rank (stack-scoped)
  const gwPointsData = await queryGwPointsForGw(tables, seasonCtx, gw);

  const allGwPoints: PointsRow[] = gwPointsData.map((p) => ({
    user_id: p.user_id,
    gw,
    points: p.points,
  }));

  const userGwPoints = allGwPoints.find((p) => p.user_id === userId);
  const score = userGwPoints?.points || 0;

  const gwRankData = calculateLastGwRank(userId, gw, allGwPoints);
  const gwRank = gwRankData?.rank || null;
  const gwRankTotal = gwRankData?.total || null;

  let fixturesQ = (supabase as any).from(tables.fixtures).select('id').eq('gw', gw);
  fixturesQ = withSeasonId(fixturesQ, seasonCtx);
  const { data: fixturesData } = await fixturesQ;
  const totalFixtures = fixturesData?.length || 10;

  // Full season points (for form windows + overall-before recalcs)
  const allSeasonPoints = await fetchAllGwPoints('asc', { seasonId });
  const overallOcp = await fetchOverallOcp({ seasonId });
  const overallForForm: OcpRow[] = overallOcp.map((o) => ({
    user_id: o.user_id,
    name: o.name,
    ocp: o.ocp || 0,
  }));

  // 2. Trophies earned in THIS GW
  const trophies = {
    gw: false,
    form5: false,
    form10: false,
    overall: false,
  };

  if (gwRank === 1) {
    trophies.gw = true;
  }

  if (gw >= 5) {
    const form5Rank = calculateFormRank(
      userId,
      gw - 4,
      gw,
      allSeasonPoints.filter((p) => p.gw >= gw - 4 && p.gw <= gw),
      overallForForm
    );
    if (form5Rank?.rank === 1) trophies.form5 = true;
  }

  if (gw >= 10) {
    const form10Rank = calculateFormRank(
      userId,
      gw - 9,
      gw,
      allSeasonPoints.filter((p) => p.gw >= gw - 9 && p.gw <= gw),
      overallForForm
    );
    if (form10Rank?.rank === 1) trophies.form10 = true;
  }

  const overallRank = calculateSeasonRank(userId, overallForForm);
  if (overallRank?.rank === 1) {
    trophies.overall = true;
  }

  // 3. ML victories for this GW (season-scoped points/picks/results)
  let mlVictories = 0;
  const mlVictoryNames: string[] = [];
  const mlVictoryData: Array<{ id: string; name: string; avatar: string | null }> = [];

  const { data: userLeagues } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId);

  if (userLeagues && userLeagues.length > 0) {
    const leagueIds = userLeagues.map((l: any) => l.league_id);

    for (const leagueId of leagueIds) {
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('id, name, avatar')
        .eq('id', leagueId)
        .maybeSingle();

      const leagueName = leagueData?.name || 'Unknown League';
      const leagueAvatar = leagueData?.avatar || null;

      const { data: members } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);

      if (!members || members.length < 2) continue;

      const memberIds = members.map((m: any) => m.user_id);

      let leaguePtsQ = (supabase as any)
        .from(tables.gwPoints)
        .select('user_id, points')
        .eq('gw', gw)
        .in('user_id', memberIds);
      if (seasonCtx.useSeasonStack && seasonCtx.seasonId) {
        leaguePtsQ = leaguePtsQ.eq('season_id', seasonCtx.seasonId);
      }
      const { data: leagueGwPoints } = await leaguePtsQ;
      if (!leagueGwPoints || leagueGwPoints.length === 0) continue;

      const unicornCounts: Map<string, number> = new Map();
      if (members.length >= 3) {
        let picksQ = (supabase as any)
          .from(tables.picks)
          .select('fixture_index, pick, user_id')
          .eq('gw', gw)
          .in('user_id', memberIds);
        picksQ = withSeasonId(picksQ, seasonCtx);
        const { data: allPicks } = await picksQ;

        let resultsQ = (supabase as any)
          .from(tables.results)
          .select('fixture_index, result')
          .eq('gw', gw);
        resultsQ = withSeasonId(resultsQ, seasonCtx);
        const { data: results } = await resultsQ;

        if (allPicks && results) {
          const fixturePicks = new Map<number, Map<'H' | 'D' | 'A', string[]>>();
          allPicks.forEach((pick: any) => {
            if (!fixturePicks.has(pick.fixture_index)) {
              fixturePicks.set(pick.fixture_index, new Map());
            }
            const picks = fixturePicks.get(pick.fixture_index)!;
            if (!picks.has(pick.pick)) {
              picks.set(pick.pick, []);
            }
            picks.get(pick.pick)!.push(pick.user_id);
          });

          results.forEach((result: any) => {
            const picks = fixturePicks.get(result.fixture_index);
            if (picks) {
              const correctPicks = picks.get(result.result);
              if (correctPicks && correctPicks.length === 1) {
                const uid = correctPicks[0];
                unicornCounts.set(uid, (unicornCounts.get(uid) || 0) + 1);
              }
            }
          });
        }
      }

      const sorted = [...leagueGwPoints]
        .map((p: any) => ({
          user_id: p.user_id,
          points: p.points || 0,
          unicorns: unicornCounts.get(p.user_id) || 0,
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.unicorns - a.unicorns;
        });

      if (sorted.length > 0 && sorted[0].user_id === userId) {
        const isDraw =
          sorted.length > 1 &&
          sorted[0].points === sorted[1].points &&
          sorted[0].unicorns === sorted[1].unicorns;
        if (!isDraw) {
          mlVictories++;
          mlVictoryNames.push(leagueName);
          mlVictoryData.push({
            id: leagueId,
            name: leagueName,
            avatar: leagueAvatar,
          });
        }
      }
    }
  }

  // 4. Leaderboard changes (before vs after this GW)
  const leaderboardChanges = {
    overall: { before: null as number | null, after: null as number | null, change: null as number | null },
    form5: { before: null as number | null, after: null as number | null, change: null as number | null },
    form10: { before: null as number | null, after: null as number | null, change: null as number | null },
  };

  const afterOverall = calculateSeasonRank(userId, overallForForm);
  leaderboardChanges.overall.after = afterOverall?.rank || null;

  if (gw > 1) {
    const pointsBefore = allSeasonPoints.filter((p) => p.gw < gw);
    const usersBefore = new Set(pointsBefore.map((p) => p.user_id));
    const overallBefore = Array.from(usersBefore).map((uid) => {
      const points = pointsBefore
        .filter((p) => p.user_id === uid)
        .reduce((sum, p) => sum + (p.points || 0), 0);
      const userData = overallForForm.find((o) => o.user_id === uid);
      return {
        user_id: uid,
        name: userData?.name || null,
        ocp: points,
      };
    });
    const beforeOverall = calculateSeasonRank(userId, overallBefore);
    leaderboardChanges.overall.before = beforeOverall?.rank || null;
  }

  if (gw >= 5) {
    const windowPts = allSeasonPoints.filter((p) => p.gw >= Math.max(1, gw - 4) && p.gw <= gw);
    const afterForm5 = calculateFormRank(userId, gw - 4, gw, windowPts, overallForForm);
    leaderboardChanges.form5.after = afterForm5?.rank || null;

    if (gw > 5) {
      const beforeForm5 = calculateFormRank(
        userId,
        gw - 5,
        gw - 1,
        windowPts.filter((p) => p.gw < gw),
        overallForForm
      );
      leaderboardChanges.form5.before = beforeForm5?.rank || null;
    }
  }

  if (gw >= 10) {
    const windowPts = allSeasonPoints.filter((p) => p.gw >= Math.max(1, gw - 9) && p.gw <= gw);
    const afterForm10 = calculateFormRank(userId, gw - 9, gw, windowPts, overallForForm);
    leaderboardChanges.form10.after = afterForm10?.rank || null;

    if (gw > 10) {
      const beforeForm10 = calculateFormRank(
        userId,
        gw - 10,
        gw - 1,
        windowPts.filter((p) => p.gw < gw),
        overallForForm
      );
      leaderboardChanges.form10.before = beforeForm10?.rank || null;
    }
  }

  if (leaderboardChanges.overall.before !== null && leaderboardChanges.overall.after !== null) {
    leaderboardChanges.overall.change =
      leaderboardChanges.overall.before - leaderboardChanges.overall.after;
  }
  if (leaderboardChanges.form5.before !== null && leaderboardChanges.form5.after !== null) {
    leaderboardChanges.form5.change =
      leaderboardChanges.form5.before - leaderboardChanges.form5.after;
  }
  if (leaderboardChanges.form10.before !== null && leaderboardChanges.form10.after !== null) {
    leaderboardChanges.form10.change =
      leaderboardChanges.form10.before - leaderboardChanges.form10.after;
  }

  return {
    score,
    totalFixtures,
    gwRank,
    gwRankTotal,
    trophies,
    mlVictories,
    mlVictoryNames,
    mlVictoryData,
    leaderboardChanges,
  };
}
