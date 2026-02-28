import type { SupabaseClient } from '@supabase/supabase-js';
import type { GwResults } from '@totl/domain';

type GwPointsRow = { user_id: string; gw: number; points: number | null };
type OverallRow = { user_id: string; name: string | null; ocp: number | null };

function safeInt(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function rankFromScores(scores: Array<{ user_id: string; score: number }>, userId: string): { rank: number | null; total: number } {
  const total = scores.length;
  const mine = scores.find((s) => s.user_id === userId);
  if (!mine) return { rank: null, total };
  const higher = scores.filter((s) => s.score > mine.score).length;
  return { rank: higher + 1, total };
}

function computeSeasonRank(overall: OverallRow[], userId: string): { rank: number | null; total: number } {
  if (!overall.length) return { rank: null, total: 0 };
  const sorted = [...overall].sort(
    (a, b) => (Number(b.ocp ?? 0) - Number(a.ocp ?? 0)) || String(a.name ?? 'User').localeCompare(String(b.name ?? 'User'))
  );
  let currentRank = 1;
  const ranked = sorted.map((p, idx) => {
    if (idx > 0 && Number(sorted[idx - 1]!.ocp ?? 0) !== Number(p.ocp ?? 0)) currentRank = idx + 1;
    return { ...p, rank: currentRank };
  });
  const entry = ranked.find((r) => r.user_id === userId);
  return { rank: entry?.rank ?? null, total: ranked.length };
}

function computeFormRank(input: {
  userId: string;
  startGw: number;
  endGw: number;
  gwPoints: GwPointsRow[];
  overall: OverallRow[];
}): { rank: number | null; total: number } {
  const { userId, startGw, endGw, gwPoints, overall } = input;
  if (endGw < startGw) return { rank: null, total: 0 };

  const userData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
  overall.forEach((o) => {
    if (!o?.user_id) return;
    userData.set(String(o.user_id), {
      user_id: String(o.user_id),
      name: String(o.name ?? 'User'),
      formPoints: 0,
      weeksPlayed: new Set<number>(),
    });
  });

  gwPoints.forEach((p) => {
    const uid = p?.user_id ? String(p.user_id) : null;
    if (!uid) return;
    if (p.gw < startGw || p.gw > endGw) return;
    const existing = userData.get(uid);
    if (!existing) return;
    existing.formPoints += Number(p.points ?? 0);
    existing.weeksPlayed.add(safeInt(p.gw));
  });

  const filtered = Array.from(userData.values()).filter((u) => {
    for (let g = startGw; g <= endGw; g += 1) if (!u.weeksPlayed.has(g)) return false;
    return true;
  });

  filtered.sort((a, b) => b.formPoints - a.formPoints || a.name.localeCompare(b.name));

  if (filtered.length === 0) return { rank: null, total: 0 };

  let currentRank = 1;
  const ranked = filtered.map((p, idx) => {
    if (idx > 0 && filtered[idx - 1]!.formPoints !== p.formPoints) currentRank = idx + 1;
    return { ...p, rank: currentRank };
  });

  const entry = ranked.find((r) => r.user_id === userId);
  return { rank: entry?.rank ?? null, total: ranked.length };
}

function computeUnicornCounts(input: {
  memberIds: string[];
  picks: Array<{ fixture_index: number; pick: 'H' | 'D' | 'A'; user_id: string }>;
  results: Array<{ fixture_index: number; result: 'H' | 'D' | 'A' }>;
}): Map<string, number> {
  const { memberIds, picks, results } = input;
  const memberSet = new Set(memberIds);
  const unicornCounts = new Map<string, number>();

  const fixturePicks = new Map<number, Map<'H' | 'D' | 'A', string[]>>();
  picks.forEach((p) => {
    if (!memberSet.has(p.user_id)) return;
    const byPick = fixturePicks.get(p.fixture_index) ?? new Map<'H' | 'D' | 'A', string[]>();
    const arr = byPick.get(p.pick) ?? [];
    arr.push(p.user_id);
    byPick.set(p.pick, arr);
    fixturePicks.set(p.fixture_index, byPick);
  });

  results.forEach((r) => {
    const byPick = fixturePicks.get(r.fixture_index);
    if (!byPick) return;
    const correct = byPick.get(r.result);
    if (!correct || correct.length !== 1) return;
    const uid = correct[0]!;
    unicornCounts.set(uid, (unicornCounts.get(uid) ?? 0) + 1);
  });

  return unicornCounts;
}

export async function computeGwResults(input: {
  userId: string;
  gw: number;
  supa: SupabaseClient;
}): Promise<GwResults> {
  const { userId, gw, supa } = input;

  const [
    gwPointsRes,
    fixturesRes,
    overallRes,
    membershipsRes,
    recentPointsRes,
    resultsRes,
  ] = await Promise.all([
    (supa as any).from('app_v_gw_points').select('user_id, points').eq('gw', gw).limit(20000),
    (supa as any).from('app_fixtures').select('id').eq('gw', gw),
    (supa as any).from('app_v_ocp_overall').select('user_id, name, ocp').limit(50000),
    (supa as any).from('league_members').select('league_id').eq('user_id', userId).limit(500),
    // Fetch recent points once (enough to compute 5/10 and their befores)
    (supa as any)
      .from('app_v_gw_points')
      .select('user_id, gw, points')
      .gte('gw', Math.max(1, gw - 10))
      .lte('gw', gw)
      .limit(200000),
    (supa as any).from('app_gw_results').select('fixture_index, result').eq('gw', gw).limit(50),
  ]);

  if (gwPointsRes.error) throw gwPointsRes.error;
  if (fixturesRes.error) throw fixturesRes.error;
  if (overallRes.error) throw overallRes.error;
  if (membershipsRes.error) throw membershipsRes.error;
  if (recentPointsRes.error) throw recentPointsRes.error;
  if (resultsRes.error) throw resultsRes.error;

  const gwPointsRows = (gwPointsRes.data ?? []) as Array<{ user_id: string; points: number | null }>;
  const gwScores = gwPointsRows
    .filter((r) => typeof r?.user_id === 'string')
    .map((r) => ({ user_id: String(r.user_id), score: Number(r.points ?? 0) }));
  const userGwPoints = gwPointsRows.find((r) => String(r.user_id) === userId);
  const score = safeInt(userGwPoints?.points ?? 0, 0);
  const { rank: gwRank, total: gwRankTotal } = rankFromScores(gwScores, userId);

  const totalFixtures = (fixturesRes.data ?? []).length || 10;

  const overallRows = (overallRes.data ?? []) as OverallRow[];
  const seasonAfter = computeSeasonRank(overallRows, userId);

  const recentPointsRows = (recentPointsRes.data ?? []) as GwPointsRow[];
  const form5After = gw >= 5 ? computeFormRank({ userId, startGw: gw - 4, endGw: gw, gwPoints: recentPointsRows, overall: overallRows }) : { rank: null, total: 0 };
  const form10After = gw >= 10 ? computeFormRank({ userId, startGw: gw - 9, endGw: gw, gwPoints: recentPointsRows, overall: overallRows }) : { rank: null, total: 0 };

  const trophies = {
    gw: gwRank === 1,
    form5: form5After.rank === 1,
    form10: form10After.rank === 1,
    overall: seasonAfter.rank === 1,
  };

  // Overall BEFORE: approximate by subtracting this GW’s points from current OCP (single-source-of-truth views).
  const pointsThisGwByUser = new Map<string, number>();
  gwPointsRows.forEach((r) => {
    if (!r?.user_id) return;
    pointsThisGwByUser.set(String(r.user_id), Number(r.points ?? 0));
  });
  const overallBeforeScores = overallRows
    .filter((r) => typeof r?.user_id === 'string')
    .map((r) => ({
      user_id: String(r.user_id),
      score: Number(r.ocp ?? 0) - (pointsThisGwByUser.get(String(r.user_id)) ?? 0),
    }));
  const seasonBefore = rankFromScores(overallBeforeScores, userId);

  const form5Before =
    gw > 5 ? computeFormRank({ userId, startGw: gw - 5, endGw: gw - 1, gwPoints: recentPointsRows, overall: overallRows }) : { rank: null, total: 0 };
  const form10Before =
    gw > 10 ? computeFormRank({ userId, startGw: gw - 10, endGw: gw - 1, gwPoints: recentPointsRows, overall: overallRows }) : { rank: null, total: 0 };

  const leaderboardChanges = {
    overall: {
      before: seasonBefore.rank,
      after: seasonAfter.rank,
      change: seasonBefore.rank !== null && seasonAfter.rank !== null ? seasonBefore.rank - seasonAfter.rank : null,
    },
    form5: {
      before: form5Before.rank,
      after: form5After.rank,
      change: form5Before.rank !== null && form5After.rank !== null ? form5Before.rank - form5After.rank : null,
    },
    form10: {
      before: form10Before.rank,
      after: form10After.rank,
      change: form10Before.rank !== null && form10After.rank !== null ? form10Before.rank - form10After.rank : null,
    },
  };

  // Mini-league victories
  const leagueIds = ((membershipsRes.data ?? []) as Array<{ league_id: string }>).map((m) => String(m.league_id)).filter(Boolean);
  let mlVictories = 0;
  const mlVictoryNames: string[] = [];
  const mlVictoryData: Array<{ id: string; name: string; avatar: string | null }> = [];

  if (leagueIds.length) {
    const [leaguesRes, leagueMembersRes, picksRes] = await Promise.all([
      (supa as any).from('leagues').select('id, name, avatar').in('id', leagueIds).limit(1000),
      (supa as any).from('league_members').select('league_id, user_id').in('league_id', leagueIds).limit(5000),
      (supa as any).from('app_picks').select('fixture_index, pick, user_id').eq('gw', gw).limit(200000),
    ]);
    if (leaguesRes.error) throw leaguesRes.error;
    if (leagueMembersRes.error) throw leagueMembersRes.error;
    if (picksRes.error) throw picksRes.error;

    const leagueMetaById = new Map<string, { id: string; name: string; avatar: string | null }>();
    (leaguesRes.data ?? []).forEach((l: any) => {
      if (!l?.id) return;
      leagueMetaById.set(String(l.id), { id: String(l.id), name: String(l.name ?? 'League'), avatar: l.avatar ? String(l.avatar) : null });
    });

    const membersByLeagueId = new Map<string, string[]>();
    (leagueMembersRes.data ?? []).forEach((m: any) => {
      const lid = m?.league_id ? String(m.league_id) : null;
      const uid = m?.user_id ? String(m.user_id) : null;
      if (!lid || !uid) return;
      const arr = membersByLeagueId.get(lid) ?? [];
      arr.push(uid);
      membersByLeagueId.set(lid, arr);
    });

    const memberIdSet = new Set<string>();
    membersByLeagueId.forEach((ids) => ids.forEach((id) => memberIdSet.add(id)));
    const memberIds = Array.from(memberIdSet);

    const leagueGwPointsRes = await (supa as any)
      .from('app_v_gw_points')
      .select('user_id, points')
      .eq('gw', gw)
      .in('user_id', memberIds)
      .limit(20000);
    if (leagueGwPointsRes.error) throw leagueGwPointsRes.error;

    const pointsByUser = new Map<string, number>();
    ((leagueGwPointsRes.data ?? []) as Array<{ user_id: string; points: number | null }>).forEach((p) => {
      if (!p?.user_id) return;
      pointsByUser.set(String(p.user_id), Number(p.points ?? 0));
    });

    const results = ((resultsRes.data ?? []) as Array<{ fixture_index: number; result: 'H' | 'D' | 'A' | null }>).filter(
      (r) => r.result === 'H' || r.result === 'D' || r.result === 'A'
    ) as Array<{ fixture_index: number; result: 'H' | 'D' | 'A' }>;

    const picks = ((picksRes.data ?? []) as any[])
      .filter((p) => (p.pick === 'H' || p.pick === 'D' || p.pick === 'A') && typeof p.fixture_index === 'number' && typeof p.user_id === 'string')
      .map((p) => ({ fixture_index: Number(p.fixture_index), pick: p.pick as 'H' | 'D' | 'A', user_id: String(p.user_id) }));

    membersByLeagueId.forEach((leagueMemberIds, leagueId) => {
      const meta = leagueMetaById.get(leagueId);
      if (!meta) return;
      if (leagueMemberIds.length < 2) return;

      // If no-one has points for this GW, ignore.
      const hasAnyPoints = leagueMemberIds.some((uid) => pointsByUser.has(uid));
      if (!hasAnyPoints) return;

      let unicornCounts = new Map<string, number>();
      if (leagueMemberIds.length >= 3 && results.length) {
        unicornCounts = computeUnicornCounts({
          memberIds: leagueMemberIds,
          picks,
          results,
        });
      }

      const sorted = leagueMemberIds
        .map((uid) => ({
          user_id: uid,
          points: pointsByUser.get(uid) ?? 0,
          unicorns: unicornCounts.get(uid) ?? 0,
        }))
        .sort((a, b) => b.points - a.points || b.unicorns - a.unicorns);

      if (!sorted.length) return;
      const first = sorted[0]!;
      const second = sorted[1] ?? null;
      const isDraw = !!second && first.points === second.points && first.unicorns === second.unicorns;
      if (first.user_id === userId && !isDraw) {
        mlVictories += 1;
        mlVictoryNames.push(meta.name);
        mlVictoryData.push({ id: meta.id, name: meta.name, avatar: meta.avatar });
      }
    });
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

