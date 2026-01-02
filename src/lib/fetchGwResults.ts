import { supabase } from './supabase';
import { calculateLastGwRank, calculateFormRank, calculateSeasonRank } from './helpers';

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

/**
 * Fetches all data needed for the Gameweek Results Modal
 * This function can be called during app initialization to pre-load data
 */
export async function fetchGwResults(userId: string, gw: number): Promise<GwResults> {
  // 1. Get GW score and rank
  const { data: gwPointsData, error: gwPointsError } = await supabase
    .from('app_v_gw_points')
    .select('user_id, points')
    .eq('gw', gw);

  if (gwPointsError) {
    throw new Error(`Failed to load GW points: ${gwPointsError.message}`);
  }

  const allGwPoints = (gwPointsData ?? []).map((p: any) => ({
    user_id: p.user_id,
    gw: gw,
    points: p.points || 0,
  }));

  const userGwPoints = allGwPoints.find((p) => p.user_id === userId);
  const score = userGwPoints?.points || 0;

  // Calculate GW rank
  const gwRankData = calculateLastGwRank(userId, gw, allGwPoints);
  const gwRank = gwRankData?.rank || null;
  const gwRankTotal = gwRankData?.total || null;

  // Get total fixtures for this GW
  const { data: fixturesData } = await supabase
    .from('app_fixtures')
    .select('id')
    .eq('gw', gw);
  const totalFixtures = fixturesData?.length || 10;

  // 2. Calculate trophies earned in THIS GW
  const trophies = {
    gw: false,
    form5: false,
    form10: false,
    overall: false,
  };

  // GW trophy: finished #1 in this GW
  if (gwRank === 1) {
    trophies.gw = true;
  }

  // 5-form trophy: finished #1 in 5-form after this GW (if GW >= 5)
  if (gw >= 5) {
    const { data: allPointsForForm } = await supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .gte('gw', gw - 4)
      .lte('gw', gw);

    const { data: overallData } = await supabase
      .from('app_v_ocp_overall')
      .select('user_id, name, ocp');

    if (allPointsForForm && overallData) {
      const form5Rank = calculateFormRank(
        userId,
        gw - 4,
        gw,
        allPointsForForm.map((p: any) => ({
          user_id: p.user_id,
          gw: p.gw,
          points: p.points || 0,
        })),
        overallData.map((o: any) => ({
          user_id: o.user_id,
          name: o.name,
          ocp: o.ocp || 0,
        }))
      );
      if (form5Rank?.rank === 1) {
        trophies.form5 = true;
      }
    }
  }

  // 10-form trophy: finished #1 in 10-form after this GW (if GW >= 10)
  if (gw >= 10) {
    const { data: allPointsForForm } = await supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .gte('gw', gw - 9)
      .lte('gw', gw);

    const { data: overallData } = await supabase
      .from('app_v_ocp_overall')
      .select('user_id, name, ocp');

    if (allPointsForForm && overallData) {
      const form10Rank = calculateFormRank(
        userId,
        gw - 9,
        gw,
        allPointsForForm.map((p: any) => ({
          user_id: p.user_id,
          gw: p.gw,
          points: p.points || 0,
        })),
        overallData.map((o: any) => ({
          user_id: o.user_id,
          name: o.name,
          ocp: o.ocp || 0,
        }))
      );
      if (form10Rank?.rank === 1) {
        trophies.form10 = true;
      }
    }
  }

  // Overall trophy: finished #1 in overall after this GW
  const { data: overallData } = await supabase
    .from('app_v_ocp_overall')
    .select('user_id, name, ocp');

  if (overallData) {
    const overallRank = calculateSeasonRank(
      userId,
      overallData.map((o: any) => ({
        user_id: o.user_id,
        name: o.name,
        ocp: o.ocp || 0,
      }))
    );
    if (overallRank?.rank === 1) {
      trophies.overall = true;
    }
  }

  // 3. Count ML victories (leagues where user finished #1 for this GW)
  let mlVictories = 0;
  const mlVictoryNames: string[] = [];
  const mlVictoryData: Array<{ id: string; name: string; avatar: string | null }> = [];

  // Get all leagues user is in
  const { data: userLeagues } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId);

  if (userLeagues && userLeagues.length > 0) {
    const leagueIds = userLeagues.map((l: any) => l.league_id);

    // For each league, check if user won
    for (const leagueId of leagueIds) {
      // Get league name and avatar
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('id, name, avatar')
        .eq('id', leagueId)
        .maybeSingle();
      
      const leagueName = leagueData?.name || 'Unknown League';
      const leagueAvatar = leagueData?.avatar || null;

      // Get all members of this league
      const { data: members } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId);

      if (!members || members.length < 2) continue; // Need at least 2 members

      const memberIds = members.map((m: any) => m.user_id);

      // Get GW points for all members
      const { data: leagueGwPoints } = await supabase
        .from('app_v_gw_points')
        .select('user_id, points')
        .eq('gw', gw)
        .in('user_id', memberIds);

      if (!leagueGwPoints || leagueGwPoints.length === 0) continue;

      // Get picks for unicorn calculation (if league has 3+ members)
      let unicornCounts: Map<string, number> = new Map();
      if (members.length >= 3) {
        const { data: allPicks } = await supabase
          .from('app_picks')
          .select('fixture_index, pick, user_id')
          .eq('gw', gw)
          .in('user_id', memberIds);

        const { data: results } = await supabase
          .from('app_gw_results')
          .select('fixture_index, result')
          .eq('gw', gw);

        if (allPicks && results) {
          // Count unicorns per user
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
                // Only one person got it right - unicorn!
                const userId = correctPicks[0];
                unicornCounts.set(userId, (unicornCounts.get(userId) || 0) + 1);
              }
            }
          });
        }
      }

      // Sort by points (desc), then unicorns (desc)
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

      // Check if user is first (and not a draw)
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

  // 4. Calculate leaderboard changes (before vs after this GW)
  const leaderboardChanges = {
    overall: { before: null as number | null, after: null as number | null, change: null as number | null },
    form5: { before: null as number | null, after: null as number | null, change: null as number | null },
    form10: { before: null as number | null, after: null as number | null, change: null as number | null },
  };

  // Get overall data before and after
  const { data: overallDataForChanges } = await supabase
    .from('app_v_ocp_overall')
    .select('user_id, name, ocp');

  if (overallDataForChanges) {
    // After: current overall rank
    const afterOverall = calculateSeasonRank(
      userId,
      overallDataForChanges.map((o: any) => ({
        user_id: o.user_id,
        name: o.name,
        ocp: o.ocp || 0,
      }))
    );
    leaderboardChanges.overall.after = afterOverall?.rank || null;

    // Before: calculate overall rank up to GW-1
    if (gw > 1) {
      const { data: allPointsBefore } = await supabase
        .from('app_v_gw_points')
        .select('user_id, gw, points')
        .lt('gw', gw);

      if (allPointsBefore) {
        const usersBefore = new Set(allPointsBefore.map((p: any) => p.user_id));
        const overallBefore = Array.from(usersBefore).map((uid) => {
          const points = allPointsBefore
            .filter((p: any) => p.user_id === uid)
            .reduce((sum, p) => sum + (p.points || 0), 0);
          const userData = overallDataForChanges.find((o: any) => o.user_id === uid);
          return {
            user_id: uid,
            name: userData?.name || null,
            ocp: points,
          };
        });

        const beforeOverall = calculateSeasonRank(userId, overallBefore);
        leaderboardChanges.overall.before = beforeOverall?.rank || null;
      }
    }
  }

  // Calculate form changes
  if (gw >= 5) {
    const { data: allPointsForForm } = await supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .gte('gw', Math.max(1, gw - 4))
      .lte('gw', gw);

    const { data: overallDataForForm } = await supabase
      .from('app_v_ocp_overall')
      .select('user_id, name, ocp');

    if (allPointsForForm && overallDataForForm) {
      // After: 5-form rank including this GW
      const afterForm5 = calculateFormRank(
        userId,
        gw - 4,
        gw,
        allPointsForForm.map((p: any) => ({
          user_id: p.user_id,
          gw: p.gw,
          points: p.points || 0,
        })),
        overallDataForForm.map((o: any) => ({
          user_id: o.user_id,
          name: o.name,
          ocp: o.ocp || 0,
        }))
      );
      leaderboardChanges.form5.after = afterForm5?.rank || null;

      // Before: 5-form rank up to GW-1
      if (gw > 5) {
        const beforeForm5 = calculateFormRank(
          userId,
          gw - 5,
          gw - 1,
          allPointsForForm
            .filter((p: any) => p.gw < gw)
            .map((p: any) => ({
              user_id: p.user_id,
              gw: p.gw,
              points: p.points || 0,
            })),
          overallDataForForm.map((o: any) => ({
            user_id: o.user_id,
            name: o.name,
            ocp: o.ocp || 0,
          }))
        );
        leaderboardChanges.form5.before = beforeForm5?.rank || null;
      }
    }
  }

  if (gw >= 10) {
    const { data: allPointsForForm } = await supabase
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .gte('gw', Math.max(1, gw - 9))
      .lte('gw', gw);

    const { data: overallDataForForm } = await supabase
      .from('app_v_ocp_overall')
      .select('user_id, name, ocp');

    if (allPointsForForm && overallDataForForm) {
      // After: 10-form rank including this GW
      const afterForm10 = calculateFormRank(
        userId,
        gw - 9,
        gw,
        allPointsForForm.map((p: any) => ({
          user_id: p.user_id,
          gw: p.gw,
          points: p.points || 0,
        })),
        overallDataForForm.map((o: any) => ({
          user_id: o.user_id,
          name: o.name,
          ocp: o.ocp || 0,
        }))
      );
      leaderboardChanges.form10.after = afterForm10?.rank || null;

      // Before: 10-form rank up to GW-1
      if (gw > 10) {
        const beforeForm10 = calculateFormRank(
          userId,
          gw - 10,
          gw - 1,
          allPointsForForm
            .filter((p: any) => p.gw < gw)
            .map((p: any) => ({
              user_id: p.user_id,
              gw: p.gw,
              points: p.points || 0,
            })),
          overallDataForForm.map((o: any) => ({
            user_id: o.user_id,
            name: o.name,
            ocp: o.ocp || 0,
          }))
        );
        leaderboardChanges.form10.before = beforeForm10?.rank || null;
      }
    }
  }

  // Calculate changes
  if (leaderboardChanges.overall.before !== null && leaderboardChanges.overall.after !== null) {
    leaderboardChanges.overall.change = leaderboardChanges.overall.before - leaderboardChanges.overall.after;
  }
  if (leaderboardChanges.form5.before !== null && leaderboardChanges.form5.after !== null) {
    leaderboardChanges.form5.change = leaderboardChanges.form5.before - leaderboardChanges.form5.after;
  }
  if (leaderboardChanges.form10.before !== null && leaderboardChanges.form10.after !== null) {
    leaderboardChanges.form10.change = leaderboardChanges.form10.before - leaderboardChanges.form10.after;
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

