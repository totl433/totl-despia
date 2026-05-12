import { api } from './api';
import { getLeagueActivationAt, resolveLeagueStartGw, resolveMemberStartGw } from './leagueStart';
import { supabase } from './supabase';
import { isDevFakeLeagueId } from './devFakeLeague';
import { SEASON_LAST_GW } from './leaderboardMonths';

export type MiniLeagueChampionSummary = {
  leagueId: string;
  leagueName: string;
  jointChampions: number;
  mltPts: number;
  unicorns: number;
  ocp: number;
};

export type OverallChampionSummary = {
  jointChampions: number;
  ocp: number;
};

type GwScore = { user_id: string; score: number; unicorns: number };

/**
 * Season mini-league champion cohort: highest mini-league table points, then unicorns, then OCP
 * (same ordering as the season table). Everyone tied on all three is a joint champion.
 */
async function computeMiniLeagueChampionSummaryForLeague(args: {
  leagueId: string;
  leagueName: string;
  members: Array<{ id: string; created_at?: string | null }>;
  seasonStartGw: number;
  latestGw: number;
  userId: string;
}): Promise<MiniLeagueChampionSummary | null> {
  const { leagueId, leagueName, members, seasonStartGw, latestGw, userId } = args;
  const memberIds = members.map((m) => String(m.id ?? '')).filter(Boolean);
  if (memberIds.length < 2 || latestGw < seasonStartGw) return null;

  const latestSeasonGw = latestGw;
  const memberPickMinGw = new Map<string, number>();
  await Promise.all(
    members.map(async (m) => {
      const id = String(m.id ?? '');
      if (!id) return;
      const joinGw = await resolveMemberStartGw(typeof m.created_at === 'string' ? m.created_at : null, seasonStartGw, latestSeasonGw);
      memberPickMinGw.set(id, joinGw);
    })
  );

  const resultsRes = await (supabase as any)
    .from('app_gw_results')
    .select('gw,fixture_index,result')
    .gte('gw', seasonStartGw);
  if (resultsRes.error) throw resultsRes.error;

  const results: Array<{ gw: number; fixture_index: number; result: 'H' | 'D' | 'A' | string }> = resultsRes.data ?? [];
  const outcomeByGwFixture = new Map<string, 'H' | 'D' | 'A'>();
  results.forEach((r) => {
    if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') return;
    outcomeByGwFixture.set(`${r.gw}:${r.fixture_index}`, r.result);
  });

  const gwsWithResults = Array.from(
    new Set(
      Array.from(outcomeByGwFixture.keys())
        .map((k) => Number.parseInt(k.split(':')[0] ?? '', 10))
        .filter((n) => Number.isFinite(n))
    )
  ).sort((a, b) => a - b);

  let relevantGws = gwsWithResults.filter((gwNum) => gwNum >= seasonStartGw);

  if (relevantGws.includes(latestSeasonGw)) {
    const fixturesForCurrentGwRes = await (supabase as any).from('app_fixtures').select('fixture_index').eq('gw', latestSeasonGw);
    if (!fixturesForCurrentGwRes.error) {
      const fixtureCount = (fixturesForCurrentGwRes.data ?? []).length;
      const resultCountForCurrentGw = Array.from(outcomeByGwFixture.keys()).filter(
        (k) => Number.parseInt(k.split(':')[0] ?? '', 10) === latestSeasonGw
      ).length;
      if (fixtureCount > 0 && resultCountForCurrentGw < fixtureCount) {
        relevantGws = relevantGws.filter((gwNum) => gwNum < latestSeasonGw);
      }
    }
  } else {
    relevantGws = relevantGws.filter((gwNum) => gwNum < latestSeasonGw);
  }

  if (relevantGws.length === 0) return null;

  const relevantGwsSet = new Set(relevantGws);
  const minPickGw = Math.min(...relevantGws);
  const maxPickGw = Math.max(...relevantGws);

  const picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }> = [];
  let from = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const pageRes = await (supabase as any)
      .from('app_picks')
      .select('user_id,gw,fixture_index,pick')
      .in('user_id', memberIds)
      .gte('gw', minPickGw)
      .lte('gw', maxPickGw)
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (pageRes.error) throw pageRes.error;
    const page = (pageRes.data ?? []) as Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }>;
    for (const row of page) {
      if (!relevantGwsSet.has(row.gw)) continue;
      const floor = memberPickMinGw.get(String(row.user_id)) ?? seasonStartGw;
      if (row.gw < floor) continue;
      picks.push(row);
    }
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const showUnicorns = memberIds.length >= 3;
  const perGw = new Map<number, Map<string, GwScore>>();
  relevantGws.forEach((g) => {
    const m = new Map<string, GwScore>();
    memberIds.forEach((uid) => m.set(uid, { user_id: uid, score: 0, unicorns: 0 }));
    perGw.set(g, m);
  });

  const picksByGwFixture = new Map<string, Array<{ user_id: string; pick: string }>>();
  picks.forEach((p) => {
    const key = `${p.gw}:${p.fixture_index}`;
    const arr = picksByGwFixture.get(key) ?? [];
    arr.push({ user_id: p.user_id, pick: p.pick });
    picksByGwFixture.set(key, arr);
  });

  relevantGws.forEach((gw) => {
    const gwMap = perGw.get(gw)!;
    const outcomesForGw = Array.from(outcomeByGwFixture.entries())
      .filter(([k]) => Number.parseInt(k.split(':')[0] ?? '', 10) === gw)
      .map(([k, out]) => ({ fixtureIndex: Number.parseInt(k.split(':')[1] ?? '', 10), out }))
      .filter((x) => Number.isFinite(x.fixtureIndex));

    outcomesForGw.forEach(({ fixtureIndex, out }) => {
      const these = picksByGwFixture.get(`${gw}:${fixtureIndex}`) ?? [];
      const correct = these.filter((p) => p.pick === out).map((p) => p.user_id);
      these.forEach((p) => {
        if (p.pick !== out) return;
        const row = gwMap.get(p.user_id);
        if (row) row.score += 1;
      });
      if (showUnicorns && correct.length === 1) {
        const lone = gwMap.get(correct[0]!);
        if (lone) lone.unicorns += 1;
      }
    });
  });

  const mltPts = new Map<string, number>();
  const ocp = new Map<string, number>();
  const unis = new Map<string, number>();
  memberIds.forEach((uid) => {
    mltPts.set(uid, 0);
    ocp.set(uid, 0);
    unis.set(uid, 0);
  });

  relevantGws.forEach((g) => {
    const rows = Array.from(perGw.get(g)!.values());
    rows.forEach((r) => {
      ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
      unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
    });

    rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
    if (!rows.length) return;
    const top = rows[0]!;
    const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
    if (coTop.length === 1) {
      mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
    } else {
      coTop.forEach((r) => {
        mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
      });
    }
  });

  const maxPts = Math.max(...memberIds.map((id) => mltPts.get(id) ?? 0));
  const ptsTier = memberIds.filter((id) => (mltPts.get(id) ?? 0) === maxPts);
  const maxUnis = Math.max(...ptsTier.map((id) => unis.get(id) ?? 0));
  const uniTier = ptsTier.filter((id) => (unis.get(id) ?? 0) === maxUnis);
  const maxOcp = Math.max(...uniTier.map((id) => ocp.get(id) ?? 0));
  const cohort = new Set(uniTier.filter((id) => (ocp.get(id) ?? 0) === maxOcp));

  if (!cohort.has(userId)) return null;

  return {
    leagueId,
    leagueName,
    jointChampions: cohort.size,
    mltPts: maxPts,
    unicorns: maxUnis,
    ocp: maxOcp,
  };
}

export async function fetchMiniLeagueChampionSummariesForUser(args: {
  userId: string;
  /** Meta current GW from home (used only to resolve each league’s start GW). */
  currentGwMeta: number;
  /** Season-ending GW (e.g. 38). */
  latestGw?: number;
}): Promise<MiniLeagueChampionSummary[]> {
  const { userId, currentGwMeta } = args;
  const latestGw = args.latestGw ?? SEASON_LAST_GW;

  const { leagues } = await api.listLeagues();
  const out: MiniLeagueChampionSummary[] = [];

  for (const summary of leagues) {
    const leagueId = String(summary.id ?? '');
    if (!leagueId || isDevFakeLeagueId(leagueId)) continue;

    try {
      const { league, members } = await api.getLeague(leagueId);
      const memberIds = members.map((m) => String(m.id ?? '')).filter(Boolean);
      if (memberIds.length < 2) continue;

      const leagueActivationAt = getLeagueActivationAt(members as Array<{ created_at?: string | null }>);
      const seasonStartGw = await resolveLeagueStartGw(
        {
          id: leagueId,
          name: typeof league?.name === 'string' ? league.name : summary.name,
          created_at: typeof league?.created_at === 'string' ? league.created_at : undefined,
          activation_at: leagueActivationAt,
          start_gw: (league as { start_gw?: unknown } | null)?.start_gw,
        },
        currentGwMeta
      );

      const computed = await computeMiniLeagueChampionSummaryForLeague({
        leagueId,
        leagueName: String(summary.name ?? league?.name ?? 'Mini league'),
        members: members as Array<{ id: string; created_at?: string | null }>,
        seasonStartGw,
        latestGw,
        userId,
      });
      if (computed) out.push(computed);
    } catch {
      // Skip leagues we cannot evaluate (permissions, transient errors).
    }
  }

  out.sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  return out;
}

export async function fetchMiniLeagueChampionSummaryForUserAndLeague(args: {
  userId: string;
  leagueId: string;
  currentGwMeta: number;
  latestGw?: number;
}): Promise<MiniLeagueChampionSummary | null> {
  const { userId, leagueId, currentGwMeta } = args;
  const latestGw = args.latestGw ?? SEASON_LAST_GW;
  if (isDevFakeLeagueId(leagueId)) return null;

  const { league, members } = await api.getLeague(leagueId);
  const memberIds = members.map((m) => String(m.id ?? '')).filter(Boolean);
  if (memberIds.length < 2) return null;

  const leagueActivationAt = getLeagueActivationAt(members as Array<{ created_at?: string | null }>);
  const seasonStartGw = await resolveLeagueStartGw(
    {
      id: leagueId,
      name: typeof league?.name === 'string' ? league.name : undefined,
      created_at: typeof league?.created_at === 'string' ? league.created_at : undefined,
      activation_at: leagueActivationAt,
      start_gw: (league as { start_gw?: unknown } | null)?.start_gw,
    },
    currentGwMeta
  );

  return computeMiniLeagueChampionSummaryForLeague({
    leagueId,
    leagueName: typeof league?.name === 'string' ? league.name : 'Mini league',
    members: members as Array<{ id: string; created_at?: string | null }>,
    seasonStartGw,
    latestGw,
    userId,
  });
}

export async function fetchOverallChampionSummaryForUser(userId: string): Promise<OverallChampionSummary | null> {
  const { rows } = await api.getOverallLeaderboard();
  if (!rows?.length) return null;

  const values = rows.map((r) => Math.round(Number(r.ocp ?? 0)));
  const maxOcp = Math.max(...values);
  const cohort = rows.filter((r) => Math.round(Number(r.ocp ?? 0)) === maxOcp).map((r) => String(r.user_id));

  if (!cohort.includes(userId)) return null;
  return { jointChampions: cohort.length, ocp: maxOcp };
}

/**
 * Every scheduled fixture in the season finale GW has a recorded H/D/A result.
 * Champion cards and Season trophies are only meaningful after this (not mid-season table leaders).
 */
export async function isSeasonFinaleGwFullyComplete(): Promise<boolean> {
  const gw = SEASON_LAST_GW;
  const fixturesRes = await (supabase as any).from('app_fixtures').select('fixture_index').eq('gw', gw);
  if (fixturesRes.error) return false;
  const fixtureCount = (fixturesRes.data ?? []).length;
  if (fixtureCount === 0) return false;

  const resultsRes = await (supabase as any).from('app_gw_results').select('fixture_index,result').eq('gw', gw);
  if (resultsRes.error) return false;
  const results = (resultsRes.data ?? []) as Array<{ fixture_index?: number; result?: string }>;
  const settled = new Set<number>();
  for (const r of results) {
    if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') continue;
    const fi = Number(r.fixture_index);
    if (Number.isFinite(fi)) settled.add(fi);
  }
  return settled.size >= fixtureCount;
}

/**
 * Season champion cards count (mini-league wins + overall champion if applicable).
 * Only non-zero after the season finale gameweek is fully resulted (same product rule as auto champion popups).
 */
export async function fetchChampionTrophyCount(userId: string, currentGwMeta: number | null): Promise<number> {
  if (!(await isSeasonFinaleGwFullyComplete())) return 0;

  const resolverGw =
    typeof currentGwMeta === 'number' && Number.isFinite(currentGwMeta) ? Math.max(currentGwMeta, SEASON_LAST_GW) : SEASON_LAST_GW;
  const [ml, overall] = await Promise.all([
    fetchMiniLeagueChampionSummariesForUser({ userId, currentGwMeta: resolverGw, latestGw: SEASON_LAST_GW }),
    fetchOverallChampionSummaryForUser(userId),
  ]);
  return ml.length + (overall ? 1 : 0);
}
