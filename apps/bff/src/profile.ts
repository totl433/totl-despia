import { resolveLeagueStartGw } from './leagueStart.js';
import { upsertSubscriber, unsubscribeSubscriber } from './mailerlite.js';

const ADMIN_IDS = new Set<string>([
  '4542c037-5b38-40d0-b189-847b8f17c222',
  '36f31625-6d6c-4aa4-815a-1493a812841b',
]);

function calculatePercentile(userValue: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const rank = allValues.filter((v) => v <= userValue).length;
  const percentile = (rank / allValues.length) * 100;
  return Math.round(percentile * 100) / 100;
}

export type ProfileSummary = {
  name: string;
  email: string | null;
  avatar_url: string | null;
  isAdmin: boolean;
  ocp: number;
  miniLeaguesCount: number;
  weeksStreak: number;
};

export async function getProfileSummary(opts: { userId: string; supa: any; accessToken: string; rootSupabase: any }) {
  const { userId, supa, accessToken, rootSupabase } = opts;

  const [userRowRes, ocpRes, leaguesCountRes, latestGwRes, gwPointsRes, submissionsRes, authRes] = await Promise.all([
    (supa as any).from('users').select('name, avatar_url').eq('id', userId).maybeSingle(),
    (supa as any).from('app_v_ocp_overall').select('ocp').eq('user_id', userId).maybeSingle(),
    (supa as any).from('league_members').select('league_id', { count: 'exact', head: true }).eq('user_id', userId),
    (supa as any).from('app_gw_results').select('gw').order('gw', { ascending: false }).limit(1).maybeSingle(),
    (supa as any).from('app_v_gw_points').select('gw').eq('user_id', userId),
    (supa as any).from('app_gw_submissions').select('gw').eq('user_id', userId),
    (rootSupabase as any).auth.getUser(accessToken),
  ]);

  if (userRowRes.error) throw userRowRes.error;
  if (ocpRes.error) throw ocpRes.error;
  if (leaguesCountRes.error) throw leaguesCountRes.error;
  if (latestGwRes.error) throw latestGwRes.error;
  if (gwPointsRes.error) throw gwPointsRes.error;
  if (submissionsRes.error) throw submissionsRes.error;
  if (authRes.error) throw authRes.error;

  const latestGw: number = Number(latestGwRes.data?.gw ?? 0);
  const gwPointsSet = new Set<number>((gwPointsRes.data ?? []).map((r: any) => Number(r.gw)));
  const submissionsSet = new Set<number>((submissionsRes.data ?? []).map((r: any) => Number(r.gw)));

  let weeksStreak = 0;
  for (let gw = latestGw; gw >= 1; gw--) {
    if (gwPointsSet.has(gw) || submissionsSet.has(gw)) weeksStreak++;
    else break;
  }

  const name = (userRowRes.data?.name as string | null) ?? 'User';
  const email = (authRes.data?.user?.email as string | null) ?? null;

  const out: ProfileSummary = {
    name,
    email,
    avatar_url: (userRowRes.data?.avatar_url as string | null) ?? null,
    isAdmin: ADMIN_IDS.has(userId),
    ocp: Number(ocpRes.data?.ocp ?? 0),
    miniLeaguesCount: Number(leaguesCountRes.count ?? 0),
    weeksStreak,
  };

  return out;
}

export type UserStatsData = {
  lastCompletedGw: number | null;
  lastCompletedGwPercentile: number | null;
  overallPercentile: number | null;
  correctPredictionRate: number | null;
  bestStreak: number;
  bestStreakGwRange: string | null;
  avgPointsPerWeek: number | null;
  bestSingleGw: { points: number; gw: number } | null;
  lowestSingleGw: { points: number; gw: number } | null;
  chaosIndex: number | null;
  chaosCorrectCount: number | null;
  chaosTotalCount: number | null;
  mostCorrectTeam: { code: string | null; name: string; percentage: number } | null;
  mostIncorrectTeam: { code: string | null; name: string; percentage: number } | null;
  weeklyParData: Array<{ gw: number; userPoints: number; averagePoints: number }> | null;
  trophyCabinet: { lastGw: number; form5: number; form10: number; overall: number } | null;
};

function calculateLastGwRank(
  userId: string,
  lastCompletedGw: number,
  allGwPoints: Array<{ user_id: string; gw: number; points: number }>
) {
  const lastGwData = allGwPoints.filter((gp) => gp.gw === lastCompletedGw);
  if (lastGwData.length === 0) return null;
  const sorted = [...lastGwData].sort((a, b) => b.points - a.points);
  let currentRank = 1;
  const ranked = sorted.map((p, idx) => {
    if (idx > 0 && sorted[idx - 1]!.points !== p.points) currentRank = idx + 1;
    return { ...p, rank: currentRank };
  });
  const me = ranked.find((r) => r.user_id === userId);
  if (!me) return null;
  const rankCount = ranked.filter((r) => r.rank === me.rank).length;
  return { rank: me.rank, total: ranked.length, score: me.points, gw: lastCompletedGw, totalFixtures: 10, isTied: rankCount > 1 };
}

function calculateSeasonRank(userId: string, overall: Array<{ user_id: string; name: string | null; ocp: number | null }>) {
  if (overall.length === 0) return null;
  const sorted = [...overall].sort(
    (a, b) => (Number(b.ocp ?? 0) - Number(a.ocp ?? 0)) || String(a.name ?? 'User').localeCompare(String(b.name ?? 'User'))
  );
  let currentRank = 1;
  const ranked = sorted.map((p, idx) => {
    if (idx > 0 && Number(sorted[idx - 1]!.ocp ?? 0) !== Number(p.ocp ?? 0)) currentRank = idx + 1;
    return { ...p, rank: currentRank };
  });
  const me = ranked.find((r) => r.user_id === userId);
  if (!me) return null;
  const rankCount = ranked.filter((r) => r.rank === me.rank).length;
  return { rank: me.rank, total: overall.length, isTied: rankCount > 1 };
}

function calculateFormRank(
  userId: string,
  startGw: number,
  endGw: number,
  allGwPoints: Array<{ user_id: string; gw: number; points: number }>,
  overall: Array<{ user_id: string; name: string | null; ocp: number | null }>
) {
  if (endGw < startGw) return null;
  const formPoints = allGwPoints.filter((gp) => gp.gw >= startGw && gp.gw <= endGw);
  const userData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
  overall.forEach((o) => {
    userData.set(o.user_id, { user_id: o.user_id, name: o.name ?? 'User', formPoints: 0, weeksPlayed: new Set() });
  });
  formPoints.forEach((gp) => {
    const u = userData.get(gp.user_id);
    if (u) {
      u.formPoints += Number(gp.points ?? 0);
      u.weeksPlayed.add(gp.gw);
    }
  });
  const sorted = Array.from(userData.values())
    .filter((u) => {
      for (let g = startGw; g <= endGw; g++) if (!u.weeksPlayed.has(g)) return false;
      return true;
    })
    .sort((a, b) => b.formPoints - a.formPoints || a.name.localeCompare(b.name));
  if (sorted.length === 0) return null;
  let currentRank = 1;
  const ranked = sorted.map((p, idx) => {
    if (idx > 0 && sorted[idx - 1]!.formPoints !== p.formPoints) currentRank = idx + 1;
    return { ...p, rank: currentRank };
  });
  const me = ranked.find((r) => r.user_id === userId);
  if (!me) return null;
  const rankCount = ranked.filter((r) => r.rank === me.rank).length;
  return { rank: me.rank, total: ranked.length, isTied: rankCount > 1 };
}

export async function getProfileStats(opts: { userId: string; supa: any }): Promise<UserStatsData> {
  const { userId, supa } = opts;

  type GwPointsUserRow = { user_id: string; gw: number; points: number };
  type GwPointsMeRow = { gw: number; points: number };

  const stats: UserStatsData = {
    lastCompletedGw: null,
    lastCompletedGwPercentile: null,
    overallPercentile: null,
    correctPredictionRate: null,
    bestStreak: 0,
    bestStreakGwRange: null,
    avgPointsPerWeek: null,
    bestSingleGw: null,
    lowestSingleGw: null,
    chaosIndex: null,
    chaosCorrectCount: null,
    chaosTotalCount: null,
    mostCorrectTeam: null,
    mostIncorrectTeam: null,
    weeklyParData: null,
    trophyCabinet: null,
  };

  // 1) Last completed GW
  const { data: lastGwData, error: lastGwErr } = await (supa as any)
    .from('app_gw_results')
    .select('gw')
    .order('gw', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastGwErr) throw lastGwErr;
  const lastCompletedGw = (lastGwData?.gw as number | null) ?? null;
  stats.lastCompletedGw = lastCompletedGw;
  if (!lastCompletedGw) return stats;

  // 2) Last GW percentile (from app_v_gw_points)
  const { data: gwPointsForLastGw, error: gwPtsErr } = await (supa as any)
    .from('app_v_gw_points')
    .select('user_id, points')
    .eq('gw', lastCompletedGw);
  if (gwPtsErr) throw gwPtsErr;
  if (gwPointsForLastGw?.length) {
    const allPoints = gwPointsForLastGw.map((p: any) => Number(p.points ?? 0));
    const userPoints = Number(gwPointsForLastGw.find((p: any) => p.user_id === userId)?.points ?? 0);
    stats.lastCompletedGwPercentile = calculatePercentile(userPoints, allPoints);
  }

  // 3) Overall percentile (from app_v_ocp_overall)
  const { data: overallStandings, error: overallErr } = await (supa as any)
    .from('app_v_ocp_overall')
    .select('user_id, name, ocp');
  if (overallErr) throw overallErr;
  if (overallStandings?.length) {
    const allOcp = overallStandings.map((s: any) => Number(s.ocp ?? 0));
    const userOcp = Number(overallStandings.find((s: any) => s.user_id === userId)?.ocp ?? 0);
    stats.overallPercentile = calculatePercentile(userOcp, allOcp);
  }

  // 4) Correct prediction rate
  const [appPicksRes, legacyPicksRes, resultsRes] = await Promise.all([
    (supa as any).from('app_picks').select('gw, fixture_index, pick').eq('user_id', userId),
    (supa as any).from('picks').select('gw, fixture_index, pick').eq('user_id', userId),
    (supa as any).from('app_gw_results').select('gw, fixture_index, result'),
  ]);
  if (appPicksRes.error) throw appPicksRes.error;
  // legacy table may not exist in some environments; tolerate missing table.
  const legacyOk = !(legacyPicksRes as any).error || (legacyPicksRes as any).error?.code === '42P01';
  if (!legacyOk) throw (legacyPicksRes as any).error;
  if (resultsRes.error) throw resultsRes.error;

  const picksMap = new Map<string, { gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' }>();
  (legacyPicksRes.data ?? []).forEach((p: any) => picksMap.set(`${p.gw}:${p.fixture_index}`, p));
  (appPicksRes.data ?? []).forEach((p: any) => picksMap.set(`${p.gw}:${p.fixture_index}`, p));
  const allPicks = Array.from(picksMap.values());

  const resultsMap = new Map<string, 'H' | 'D' | 'A'>();
  (resultsRes.data ?? []).forEach((r: any) => {
    if (r.result) resultsMap.set(`${r.gw}:${r.fixture_index}`, r.result);
  });

  let correct = 0;
  let total = 0;
  allPicks.forEach((p) => {
    const res = resultsMap.get(`${p.gw}:${p.fixture_index}`);
    if (!res) return;
    total++;
    if (p.pick === res) correct++;
  });
  if (total > 0) stats.correctPredictionRate = (correct / total) * 100;

  // 5) Avg points + best streak + weekly par + trophy cabinet
  const { data: userGwPoints, error: userGwErr } = await (supa as any)
    .from('app_v_gw_points')
    .select('gw, points')
    .eq('user_id', userId)
    .order('gw', { ascending: true });
  if (userGwErr) throw userGwErr;

  const { data: allGwPoints, error: allGwErr } = await (supa as any)
    .from('app_v_gw_points')
    .select('user_id, gw, points')
    .order('gw', { ascending: true });
  if (allGwErr) throw allGwErr;

  const allGwPointsTyped = (allGwPoints ?? []).map((p: any) => ({
    user_id: String(p.user_id),
    gw: Number(p.gw),
    points: Number(p.points ?? 0),
  })) as GwPointsUserRow[];

  const userGwPointsTyped = (userGwPoints ?? []).map((p: any) => ({ gw: Number(p.gw), points: Number(p.points ?? 0) })) as GwPointsMeRow[];

  if (userGwPointsTyped.length) {
    const totalPoints = userGwPointsTyped.reduce((sum, p) => sum + p.points, 0);
    stats.avgPointsPerWeek = totalPoints / userGwPointsTyped.length;

    let bestGw = { points: -1, gw: 0 };
    let lowestGw = { points: Number.POSITIVE_INFINITY, gw: 0 };
    userGwPointsTyped.forEach((p) => {
      if (p.points > bestGw.points) bestGw = { points: p.points, gw: p.gw };
      if (p.points < lowestGw.points) lowestGw = { points: p.points, gw: p.gw };
    });
    if (bestGw.points >= 0) stats.bestSingleGw = bestGw;
    if (Number.isFinite(lowestGw.points)) stats.lowestSingleGw = lowestGw;
  }

  // Percentiles per GW (for streak + weekly par average)
  const byGw = new Map<number, Array<{ user_id: string; points: number }>>();
  allGwPointsTyped.forEach((p) => {
    const arr = byGw.get(p.gw) ?? [];
    arr.push({ user_id: p.user_id, points: p.points });
    byGw.set(p.gw, arr);
  });

  const completedGws: number[] = Array.from(
    new Set<number>((resultsRes.data ?? []).map((r: any) => Number(r?.gw)).filter((n: number) => Number.isFinite(n)))
  ).sort((a: number, b: number) => a - b);

  const gwPercentiles = new Map<number, number>();
  completedGws.forEach((gw) => {
    const pts = byGw.get(gw) ?? [];
    if (!pts.length) return;
    const allPoints = pts.map((x) => x.points);
    const userPoints = pts.find((x) => x.user_id === userId)?.points ?? 0;
    gwPercentiles.set(gw, calculatePercentile(userPoints, allPoints));
  });

  // Best streak: consecutive completed GWs where user percentile >= 75
  let currentStreak = 0;
  let bestStreak = 0;
  let bestStart = 0;
  let bestEnd = 0;
  let currentStart = 0;
  completedGws.forEach((gw) => {
    const pct = gwPercentiles.get(gw);
    if (pct !== undefined && pct >= 75) {
      if (currentStreak === 0) currentStart = gw;
      currentStreak++;
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
        bestStart = currentStart;
        bestEnd = gw;
      }
    } else {
      currentStreak = 0;
    }
  });
  stats.bestStreak = bestStreak;
  stats.bestStreakGwRange = bestStreak > 0 ? `GW${bestStart}–GW${bestEnd}` : null;

  // Weekly par: user points vs average points for each GW they played
  const gwAverages = new Map<number, number>();
  byGw.forEach((pts, gw) => {
    const avg = pts.reduce((sum: number, x) => sum + x.points, 0) / Math.max(1, pts.length);
    gwAverages.set(gw, avg);
  });
  const weeklyPar = userGwPointsTyped
    .map((p) => ({ gw: p.gw, userPoints: p.points, averagePoints: gwAverages.get(p.gw) }))
    .filter((x): x is { gw: number; userPoints: number; averagePoints: number } => typeof x.averagePoints === 'number')
    .sort((a, b) => a.gw - b.gw);
  stats.weeklyParData = weeklyPar.length ? weeklyPar : null;

  // Trophy cabinet (reuse overallStandings as “overall” baseline for names/users).
  const trophyCabinet = { lastGw: 0, form5: 0, form10: 0, overall: 0 };
  const overallForRanks = (overallStandings ?? []).map((o: any) => ({
    user_id: String(o.user_id),
    name: (o.name as string | null) ?? 'User',
    ocp: Number(o.ocp ?? 0),
  }));

  completedGws.forEach((gw) => {
    const lastGwRank = calculateLastGwRank(userId, gw, allGwPointsTyped);
    if (lastGwRank?.rank === 1) trophyCabinet.lastGw++;

    if (gw >= 5) {
      const form5 = calculateFormRank(userId, gw - 4, gw, allGwPointsTyped, overallForRanks);
      if (form5?.rank === 1) trophyCabinet.form5++;
    }
    if (gw >= 10) {
      const form10 = calculateFormRank(userId, gw - 9, gw, allGwPointsTyped, overallForRanks);
      if (form10?.rank === 1) trophyCabinet.form10++;
    }

    // Overall trophy “at gw”: approximate by cumulative points up to gw (matches web’s approach).
    const usersUpToGw = new Set<string>();
    allGwPointsTyped.forEach((p) => {
      if (p.gw <= gw) usersUpToGw.add(p.user_id);
    });
    const overallAtGw = Array.from(usersUpToGw).map((uid) => {
      const sum = allGwPointsTyped
        .filter((p) => p.user_id === uid && p.gw <= gw)
        .reduce((s: number, p) => s + p.points, 0);
      const base = overallForRanks.find((o: any) => o.user_id === uid);
      return { user_id: uid, name: base?.name ?? null, ocp: sum };
    });
    const overallRank = calculateSeasonRank(userId, overallAtGw);
    if (overallRank?.rank === 1) trophyCabinet.overall++;
  });
  stats.trophyCabinet = trophyCabinet;

  // Chaos index + team stats are expensive; keep parity but avoid exploding if user has no picks.
  if (allPicks.length) {
    const gws: number[] = Array.from(new Set(allPicks.map((p) => Number(p.gw)).filter((n) => Number.isFinite(n)))) as number[];
    const [allUsersApp, allUsersLegacy] = await Promise.all([
      (supa as any).from('app_picks').select('gw, fixture_index, pick').in('gw', gws),
      (supa as any).from('picks').select('gw, fixture_index, pick').in('gw', gws),
    ]);
    if (allUsersApp.error) throw allUsersApp.error;
    const legacy2Ok = !(allUsersLegacy as any).error || (allUsersLegacy as any).error?.code === '42P01';
    if (!legacy2Ok) throw (allUsersLegacy as any).error;

    const pickCounts = new Map<string, Map<'H' | 'D' | 'A', number>>();
    const addCounts = (rows: any[]) => {
      rows.forEach((p) => {
        const key = `${p.gw}:${p.fixture_index}`;
        if (!pickCounts.has(key)) pickCounts.set(key, new Map());
        const m = pickCounts.get(key)!;
        const pick = p.pick as 'H' | 'D' | 'A';
        m.set(pick, (m.get(pick) ?? 0) + 1);
      });
    };
    addCounts(allUsersLegacy.data ?? []);
    addCounts(allUsersApp.data ?? []);

    let chaosPicks = 0;
    let chaosCorrect = 0;
    let totalChecked = 0;
    allPicks.forEach((p) => {
      const key = `${p.gw}:${p.fixture_index}`;
      const counts = pickCounts.get(key);
      if (!counts) return;
      const totalPickers = Array.from(counts.values()).reduce((s, n) => s + n, 0);
      if (!totalPickers) return;
      const userPickCount = counts.get(p.pick) ?? 0;
      const pct = (userPickCount / totalPickers) * 100;
      totalChecked++;
      if (pct <= 25) {
        chaosPicks++;
        const res = resultsMap.get(key);
        if (res && res === p.pick) chaosCorrect++;
      }
    });
    if (totalChecked > 0) {
      stats.chaosIndex = (chaosPicks / totalChecked) * 100;
      stats.chaosCorrectCount = chaosCorrect;
      stats.chaosTotalCount = chaosPicks;
    }

    // Team stats: requires fixtures mapping for picked+resulted fixtures.
    const { data: fixturesData, error: fxErr } = await (supa as any)
      .from('app_fixtures')
      .select('gw, fixture_index, home_code, away_code, home_name, away_name, home_team, away_team, api_match_id');
    if (fxErr) throw fxErr;
    const fixturesMap = new Map<string, any>();
    (fixturesData ?? []).forEach((f: any) => {
      if (f.api_match_id) return;
      fixturesMap.set(`${f.gw}:${f.fixture_index}`, f);
    });

    const teamStats = new Map<string, { correct: number; total: number; code: string | null; name: string }>();
    allPicks.forEach((p) => {
      const key = `${p.gw}:${p.fixture_index}`;
      const fixture = fixturesMap.get(key);
      const result = resultsMap.get(key);
      if (!fixture || !result) return;
      const userGotItRight = p.pick === result;

      const homeCode = typeof fixture.home_code === 'string' ? fixture.home_code : null;
      const awayCode = typeof fixture.away_code === 'string' ? fixture.away_code : null;
      const homeName = String(fixture.home_name || fixture.home_team || 'Home');
      const awayName = String(fixture.away_name || fixture.away_team || 'Away');

      const bump = (code: string | null, name: string) => {
        if (!code) return;
        const k = String(code).toUpperCase();
        const existing = teamStats.get(k) ?? { correct: 0, total: 0, code, name };
        existing.total++;
        if (userGotItRight) existing.correct++;
        teamStats.set(k, existing);
      };
      bump(homeCode, homeName);
      bump(awayCode, awayName);
    });

    let mostCorrect: { code: string | null; name: string; percentage: number } | null = null;
    let mostIncorrect: { code: string | null; name: string; percentage: number } | null = null;
    teamStats.forEach((s) => {
      if (s.total < 3) return;
      const correctPct = (s.correct / s.total) * 100;
      const incorrectPct = ((s.total - s.correct) / s.total) * 100;
      if (!mostCorrect || correctPct > mostCorrect.percentage) mostCorrect = { code: s.code, name: s.name, percentage: correctPct };
      if (!mostIncorrect || incorrectPct > mostIncorrect.percentage) mostIncorrect = { code: s.code, name: s.name, percentage: incorrectPct };
    });
    stats.mostCorrectTeam = mostCorrect;
    stats.mostIncorrectTeam = mostIncorrect;
  }

  return stats;
}

export type UnicornCard = {
  fixture_index: number;
  gw: number;
  home_team: string;
  away_team: string;
  home_code: string | null;
  away_code: string | null;
  home_name: string | null;
  away_name: string | null;
  kickoff_time: string | null;
  pick: 'H' | 'D' | 'A';
  league_names: string[];
};

export async function getProfileUnicorns(opts: { userId: string; supa: any }): Promise<UnicornCard[]> {
  const { userId, supa } = opts;

  const { data: leaguesRows, error: leaguesErr } = await (supa as any)
    .from('league_members')
    .select('league_id, leagues(id, name, created_at)')
    .eq('user_id', userId);
  if (leaguesErr) throw leaguesErr;

  const leagues = (leaguesRows ?? []).map((r: any) => r.leagues).filter(Boolean) as Array<{ id: string; name: string; created_at: string | null }>;
  if (!leagues.length) return [];

  const leagueIds = leagues.map((l) => l.id);
  const [membersRes, resultsRes, metaRes] = await Promise.all([
    (supa as any).from('league_members').select('league_id, user_id').in('league_id', leagueIds),
    (supa as any).from('app_gw_results').select('gw, fixture_index, result').order('gw', { ascending: false }),
    (supa as any).from('app_meta').select('current_gw').eq('id', 1).maybeSingle(),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (resultsRes.error) throw resultsRes.error;
  if (metaRes.error) throw metaRes.error;
  const currentGw = Number(metaRes.data?.current_gw ?? 1);

  const membersByLeague = new Map<string, string[]>();
  (membersRes.data ?? []).forEach((lm: any) => {
    const arr = membersByLeague.get(lm.league_id) ?? [];
    arr.push(String(lm.user_id));
    membersByLeague.set(String(lm.league_id), arr);
  });

  const resultsMap = new Map<string, 'H' | 'D' | 'A'>();
  (resultsRes.data ?? []).forEach((r: any) => {
    if (r.result) resultsMap.set(`${r.gw}:${r.fixture_index}`, r.result);
  });
  const gwsWithResults = Array.from(new Set((resultsRes.data ?? []).map((r: any) => Number(r.gw))));
  if (!gwsWithResults.length) return [];

  const allMemberIds = Array.from(new Set((membersRes.data ?? []).map((lm: any) => String(lm.user_id))));
  if (!allMemberIds.length) return [];

  const { data: picksData, error: picksErr } = await (supa as any)
    .from('app_picks')
    .select('user_id, gw, fixture_index, pick')
    .in('user_id', allMemberIds);
  if (picksErr) throw picksErr;

  const { data: fixturesData, error: fixturesErr } = await (supa as any)
    .from('app_fixtures')
    .select('gw, fixture_index, home_team, away_team, home_code, away_code, home_name, away_name, kickoff_time, api_match_id')
    .in('gw', gwsWithResults)
    .order('gw', { ascending: false })
    .order('fixture_index', { ascending: true });
  if (fixturesErr) throw fixturesErr;

  const fixturesMap = new Map<string, any>();
  (fixturesData ?? []).forEach((f: any) => {
    if (f.api_match_id) return;
    fixturesMap.set(`${f.gw}:${f.fixture_index}`, f);
  });

  const unicornsRaw: Array<
    UnicornCard & {
      league_id: string;
      league_name: string;
    }
  > = [];

  for (const league of leagues) {
    if (league.name === 'API Test') continue;
    const members = membersByLeague.get(league.id) ?? [];
    if (members.length < 3) continue;

    const leagueStartGw = await resolveLeagueStartGw(supa, league, currentGw);
    const leaguePicks = (picksData ?? []).filter((p: any) => members.includes(String(p.user_id)) && Number(p.gw) >= leagueStartGw);

    const picksByFixture = new Map<string, Array<{ user_id: string; pick: 'H' | 'D' | 'A' }>>();
    leaguePicks.forEach((p: any) => {
      const key = `${p.gw}:${p.fixture_index}`;
      const arr = picksByFixture.get(key) ?? [];
      arr.push({ user_id: String(p.user_id), pick: p.pick });
      picksByFixture.set(key, arr);
    });

    picksByFixture.forEach((picks, key) => {
      const [gwS, idxS] = key.split(':');
      const gw = Number(gwS);
      const fixtureIndex = Number(idxS);
      if (gw < leagueStartGw) return;
      const result = resultsMap.get(key);
      if (!result) return;

      const userPick = picks.find((p) => p.user_id === userId);
      if (!userPick) return;

      const correctUsers = picks.filter((p) => p.pick === result).map((p) => p.user_id);
      if (correctUsers.length === 1 && correctUsers[0] === userId && members.length >= 3) {
        const fixture = fixturesMap.get(key);
        if (!fixture) return;
        unicornsRaw.push({
          fixture_index: fixtureIndex,
          gw,
          home_team: String(fixture.home_team),
          away_team: String(fixture.away_team),
          home_code: typeof fixture.home_code === 'string' ? fixture.home_code : null,
          away_code: typeof fixture.away_code === 'string' ? fixture.away_code : null,
          home_name: typeof fixture.home_name === 'string' ? fixture.home_name : null,
          away_name: typeof fixture.away_name === 'string' ? fixture.away_name : null,
          kickoff_time: typeof fixture.kickoff_time === 'string' ? fixture.kickoff_time : null,
          pick: userPick.pick,
          league_names: [],
          league_id: league.id,
          league_name: league.name,
        });
      }
    });
  }

  // Group by fixture and collect league names.
  const grouped = new Map<string, UnicornCard>();
  unicornsRaw.forEach((u) => {
    const key = `${u.gw}:${u.fixture_index}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.league_names.includes(u.league_name)) existing.league_names.push(u.league_name);
      return;
    }
    grouped.set(key, {
      fixture_index: u.fixture_index,
      gw: u.gw,
      home_team: u.home_team,
      away_team: u.away_team,
      home_code: u.home_code,
      away_code: u.away_code,
      home_name: u.home_name,
      away_name: u.away_name,
      kickoff_time: u.kickoff_time,
      pick: u.pick,
      league_names: [u.league_name],
    });
  });

  return Array.from(grouped.values()).sort((a, b) => a.gw - b.gw || a.fixture_index - b.fixture_index);
}

export type EmailPreferences = { new_gameweek: boolean; results_published: boolean; news_updates: boolean };

export async function getEmailPreferences(opts: { userId: string; supa: any }): Promise<EmailPreferences> {
  const { userId, supa } = opts;
  const { data, error } = await (supa as any)
    .from('email_preferences')
    .select('new_gameweek, results_published, news_updates')
    .eq('user_id', userId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return {
    new_gameweek: Boolean(data?.new_gameweek ?? false),
    results_published: Boolean(data?.results_published ?? false),
    news_updates: Boolean(data?.news_updates ?? false),
  };
}

export async function updateEmailPreferences(opts: { userId: string; supa: any; email: string | null; input: Partial<EmailPreferences> }) {
  const { userId, supa, email, input } = opts;
  const existing = await getEmailPreferences({ userId, supa });
  const next: EmailPreferences = {
    new_gameweek: input.new_gameweek ?? existing.new_gameweek,
    results_published: input.results_published ?? existing.results_published,
    news_updates: input.news_updates ?? existing.news_updates,
  };

  const { error } = await (supa as any).from('email_preferences').upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });
  if (error) throw error;

  // Best-effort MailerLite sync (do not fail the request on MailerLite errors).
  if (email) {
    const hasAny = next.new_gameweek || next.results_published || next.news_updates;
    if (hasAny) {
      void upsertSubscriber(email, next);
    } else {
      void unsubscribeSubscriber(email);
    }
  }

  return next;
}

