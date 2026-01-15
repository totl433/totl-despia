/**
 * Unified data loading for HomePage
 * Loads all required data in a single, stable function
 * Only updates state once when all data is ready
 */

import { supabase } from './supabase';
import { getCached, setCached, getCacheTimestamp, CACHE_TTL } from './cache';
import { resolveLeagueStartGw } from './leagueStart';
import { APP_ONLY_USER_IDS } from './appOnlyUsers';
import { logDataFetch } from './dataFetchLogger';

type LeagueMember = { id: string; name: string };
type PickRow = { user_id: string; gw: number; fixture_index: number; pick: "H" | "D" | "A" };
type ResultRowRaw = { gw: number; fixture_index: number; result?: "H" | "D" | "A" | null };
type MLTableRow = { user_id: string; name: string; score: number; unicorns: number };

type LeagueDataInternal = {
  id: string;
  members: LeagueMember[];
  userPosition: number | null;
  positionChange: 'up' | 'down' | 'same' | null;
  submittedMembers: Set<string>;
  sortedMemberIds: string[];
  latestGwWinners: Set<string>;
  latestRelevantGw: number | null;
  webUserIds: Set<string>;
};

type HomePageData = {
  gw: number;
  latestGw: number;
  fixtures: any[];
  userPicks: Record<number, "H" | "D" | "A">;
  leagueData: Record<string, LeagueDataInternal>;
  leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
  leaguePicks: Record<string, PickRow[]>; // leagueId -> picks array for current GW
  leagueSubmissionsSet: Record<string, Set<string>>; // leagueId -> submitted user IDs
  leagueRows: Record<string, MLTableRow[]>; // leagueId -> pre-calculated table rows for current GW
  gwPoints: Array<{user_id: string, gw: number, points: number}>;
  allGwPoints: Array<{user_id: string, gw: number, points: number}>;
  overall: Array<{user_id: string, name: string | null, ocp: number | null}>;
  lastGwRank: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null;
  fiveGwRank: { rank: number; total: number; isTied: boolean } | null;
  tenGwRank: { rank: number; total: number; isTied: boolean } | null;
  seasonRank: { rank: number; total: number; isTied: boolean } | null;
};

function rowToOutcome(r: ResultRowRaw): "H" | "D" | "A" | null {
  if (!r.result) return null;
  return r.result;
}

function calculateLastGwRank(
  userId: string,
  gw: number,
  allPoints: Array<{user_id: string, gw: number, points: number}>,
  results: ResultRowRaw[]
): { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null {
  const gwPoints = allPoints.filter(p => p.gw === gw);
  if (gwPoints.length === 0) return null;
  
  const userPoints = gwPoints.find(p => p.user_id === userId)?.points ?? 0;
  const sorted = [...gwPoints].sort((a, b) => b.points - a.points);
  const rank = sorted.findIndex(p => p.user_id === userId) + 1;
  const total = gwPoints.length;
  const isTied = sorted.filter(p => p.points === userPoints).length > 1;
  const totalFixtures = results.filter(r => r.gw === gw).length;
  
  return { rank, total, score: userPoints, gw, totalFixtures, isTied };
}

function calculateFormRank(
  userId: string,
  startGw: number,
  endGw: number,
  allPoints: Array<{user_id: string, gw: number, points: number}>
): { rank: number; total: number; isTied: boolean } | null {
  const formPoints = allPoints.filter(p => p.gw >= startGw && p.gw <= endGw);
  if (formPoints.length === 0) return null;
  
  const userTotal = formPoints.filter(p => p.user_id === userId).reduce((sum, p) => sum + p.points, 0);
  const userMap = new Map<string, number>();
  formPoints.forEach(p => {
    userMap.set(p.user_id, (userMap.get(p.user_id) ?? 0) + p.points);
  });
  
  const sorted = Array.from(userMap.entries()).sort((a, b) => b[1] - a[1]);
  const rank = sorted.findIndex(([id]) => id === userId) + 1;
  const total = sorted.length;
  const isTied = sorted.filter(([, points]) => points === userTotal).length > 1;
  
  return { rank, total, isTied };
}

function calculateSeasonRank(
  userId: string,
  overall: Array<{user_id: string, name: string | null, ocp: number | null}>
): { rank: number; total: number; isTied: boolean } | null {
  if (overall.length === 0) return null;
  
  const userOcp = overall.find(o => o.user_id === userId)?.ocp ?? null;
  if (userOcp === null) return null;
  
  const sorted = [...overall].sort((a, b) => (b.ocp ?? 0) - (a.ocp ?? 0));
  const rank = sorted.findIndex(o => o.user_id === userId) + 1;
  const total = sorted.length;
  const isTied = sorted.filter(o => (o.ocp ?? 0) === userOcp).length > 1;
  
  return { rank, total, isTied };
}

export async function loadHomePageData(
  userId: string,
  leagues: Array<{ id: string; name: string }>,
  currentGw: number
): Promise<HomePageData> {
  // Check cache first
  const basicCacheKey = `home:basic:${userId}`;
  const fixturesCacheKey = `home:fixtures:${userId}:${currentGw}`;
  const leagueDataCacheKey = `home:leagueData:v6:${userId}:${currentGw}`; // v6: Ensure HP ordering matches /tables (avoid truncated prewarm caches)
  
  const cachedBasic = getCached<{
    currentGw: number;
    latestGw: number;
    allGwPoints: Array<{user_id: string, gw: number, points: number}>;
    overall: Array<{user_id: string, name: string | null, ocp: number | null}>;
    lastGwRank: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null;
    fiveGwRank?: { rank: number; total: number; isTied: boolean } | null;
    tenGwRank?: { rank: number; total: number; isTied: boolean } | null;
    seasonRank?: { rank: number; total: number; isTied: boolean } | null;
  }>(basicCacheKey);
  
  const cachedFixtures = getCached<{
    fixtures: any[];
    userPicks: Record<number, "H" | "D" | "A">;
  }>(fixturesCacheKey);
  
  const cachedLeagueData = getCached<{
    leagueData: Record<string, any>;
    leagueSubmissions: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }>;
    leaguePicks?: Record<string, PickRow[]>;
    leagueSubmissionsSet?: Record<string, string[]>;
    leagueRows?: Record<string, MLTableRow[]>;
  }>(leagueDataCacheKey);
  
  // Check if cache is fresh (within 2 minutes for fixtures, 5 minutes for league data)
  const basicCacheAge = cachedBasic ? (Date.now() - (getCacheTimestamp(basicCacheKey) ?? 0)) : Infinity;
  const fixturesCacheAge = cachedFixtures ? (Date.now() - (getCacheTimestamp(fixturesCacheKey) ?? 0)) : Infinity;
  const leagueCacheAge = cachedLeagueData ? (Date.now() - (getCacheTimestamp(leagueDataCacheKey) ?? 0)) : Infinity;
  
  const isBasicCacheFresh = basicCacheAge < CACHE_TTL.HOME;
  const isFixturesCacheFresh = fixturesCacheAge < 2 * 60 * 1000; // 2 minutes
  const isLeagueCacheFresh = leagueCacheAge < 5 * 60 * 1000; // 5 minutes
  
  // Check if cache has the new fields (leaguePicks/leagueSubmissionsSet/leagueRows)
  const hasNewFields = cachedLeagueData?.leaguePicks !== undefined && 
                       cachedLeagueData?.leagueSubmissionsSet !== undefined &&
                       cachedLeagueData?.leagueRows !== undefined;
  
  // If cache is fresh but missing new fields, treat as stale to force fetch
  // This ensures picks/submissions/rows data loads on first use of new code
  const effectiveLeagueCacheFresh = isLeagueCacheFresh && hasNewFields;
  
  // If all caches are fresh AND have new fields, return cached data
  if (isBasicCacheFresh && isFixturesCacheFresh && effectiveLeagueCacheFresh && 
      cachedBasic && cachedFixtures && cachedLeagueData?.leagueData) {
    
    // Restore Sets from arrays for league data
    const restoredLeagueData: Record<string, LeagueDataInternal> = {};
    for (const [leagueId, data] of Object.entries(cachedLeagueData.leagueData)) {
      restoredLeagueData[leagueId] = {
        ...data,
        submittedMembers: data.submittedMembers ? (Array.isArray(data.submittedMembers) ? new Set(data.submittedMembers) : data.submittedMembers) : new Set(),
        latestGwWinners: data.latestGwWinners ? (Array.isArray(data.latestGwWinners) ? new Set(data.latestGwWinners) : data.latestGwWinners) : new Set(),
        webUserIds: data.webUserIds ? (Array.isArray(data.webUserIds) ? new Set(data.webUserIds) : data.webUserIds) : new Set(),
      };
    }
    
    // Restore leaguePicks, leagueSubmissionsSet, and leagueRows from cache
    const restoredLeaguePicks: Record<string, PickRow[]> = cachedLeagueData.leaguePicks || {};
    const restoredLeagueSubmissionsSet: Record<string, Set<string>> = {};
    if (cachedLeagueData.leagueSubmissionsSet) {
      for (const [leagueId, userIds] of Object.entries(cachedLeagueData.leagueSubmissionsSet)) {
        restoredLeagueSubmissionsSet[leagueId] = new Set(userIds);
      }
    }
    const restoredLeagueRows: Record<string, MLTableRow[]> = cachedLeagueData.leagueRows || {};
    
    return {
      gw: cachedBasic.currentGw,
      latestGw: cachedBasic.latestGw,
      fixtures: cachedFixtures.fixtures,
      userPicks: cachedFixtures.userPicks,
      leagueData: restoredLeagueData,
      leagueSubmissions: cachedLeagueData.leagueSubmissions,
      leaguePicks: restoredLeaguePicks,
      leagueSubmissionsSet: restoredLeagueSubmissionsSet,
      leagueRows: restoredLeagueRows,
      gwPoints: (cachedBasic.allGwPoints || []).filter(gp => gp.user_id === userId),
      allGwPoints: cachedBasic.allGwPoints || [],
      overall: cachedBasic.overall || [],
      lastGwRank: cachedBasic.lastGwRank || null,
      fiveGwRank: cachedBasic.fiveGwRank ?? null,
      tenGwRank: cachedBasic.tenGwRank ?? null,
      seasonRank: cachedBasic.seasonRank ?? null,
    };
  }
  
  // Fetch all data in parallel
  const leagueIds = leagues.map(l => l.id);
  
  const [
    metaResult,
    latestGwResult,
    allGwPointsResult,
    overallResult,
    fixturesResult,
    picksResult,
    membersResult,
    submissionsResult,
    resultsResult,
    webPicksResult,
    appPicksResult,
  ] = await Promise.all([
    supabase.from("app_meta").select("current_gw").eq("id", 1).maybeSingle(),
    // IMPORTANT: use app_gw_results as the source of truth (matches /tables)
    supabase.from("app_gw_results").select("gw").order("gw", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("app_v_gw_points").select("user_id, gw, points").order("gw", { ascending: true }),
    supabase.from("app_v_ocp_overall").select("user_id, name, ocp"),
    supabase.from("app_fixtures").select("id, gw, fixture_index, api_match_id, home_code, away_code, home_team, away_team, home_name, away_name, kickoff_time").eq("gw", currentGw).order("fixture_index", { ascending: true }),
    supabase.from("app_picks").select("user_id, gw, fixture_index, pick").eq("user_id", userId).eq("gw", currentGw),
    leagueIds.length > 0 ? supabase.from("league_members").select("league_id, user_id, users!inner(id, name)").in("league_id", leagueIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("app_gw_submissions").select("user_id").eq("gw", currentGw).not("submitted_at", "is", null),
    supabase.from("app_gw_results").select("gw, fixture_index, result"),
    supabase.from("picks").select("user_id, gw, created_at").limit(10000),
    supabase.from("app_picks").select("user_id, gw, created_at").limit(10000),
  ]);
  
  // Log critical queries for debugging
  logDataFetch('loadHomePageData', 'Fetch league members', 'league_members', membersResult, { leagueIds: leagueIds.length, userId });
  logDataFetch('loadHomePageData', 'Fetch fixtures', 'app_fixtures', fixturesResult, { gw: currentGw, userId });
  logDataFetch('loadHomePageData', 'Fetch user picks', 'app_picks', picksResult, { gw: currentGw, userId });
  if (fixturesResult.error || membersResult.error) {
    logDataFetch('loadHomePageData', 'Fetch meta', 'app_meta', metaResult, { userId });
    logDataFetch('loadHomePageData', 'Fetch overall standings', 'app_v_ocp_overall', overallResult, { userId });
  }
  
  const gw = metaResult.data?.current_gw ?? currentGw;
  const latestGw = latestGwResult.data?.gw ?? gw;
  const allGwPoints = (allGwPointsResult.data as Array<{user_id: string, gw: number, points: number}>) ?? [];
  const overall = (overallResult.data as Array<{user_id: string, name: string | null, ocp: number | null}>) ?? [];
  const fixtures = (fixturesResult.data ?? []) as any[];
  
  // Process picks
  const userPicks: Record<number, "H" | "D" | "A"> = {};
  (picksResult.data ?? []).forEach((p: any) => {
    if (p.pick && (p.pick === "H" || p.pick === "D" || p.pick === "A")) {
      userPicks[p.fixture_index] = p.pick;
    }
  });
  
  // Process results
  const outcomeByGwIdx = new Map<string, "H" | "D" | "A">();
  (resultsResult.data ?? []).forEach((r: any) => {
    const out = rowToOutcome(r);
    if (out) outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
  });
  
  const results = (resultsResult.data ?? []) as ResultRowRaw[];
  const lastGwRank = calculateLastGwRank(userId, latestGw, allGwPoints, results);
  const fiveGwRank = latestGw >= 5 ? calculateFormRank(userId, latestGw - 4, latestGw, allGwPoints) : null;
  const tenGwRank = latestGw >= 10 ? calculateFormRank(userId, latestGw - 9, latestGw, allGwPoints) : null;
  const seasonRank = calculateSeasonRank(userId, overall);
  
  // Process league data
  const membersByLeague: Record<string, LeagueMember[]> = {};
  (membersResult.data ?? []).forEach((m: any) => {
    if (!membersByLeague[m.league_id]) {
      membersByLeague[m.league_id] = [];
    }
    membersByLeague[m.league_id].push({
      id: m.users.id,
      name: m.users.name
    });
  });
  
  const allMemberIdsSet = new Set(Object.values(membersByLeague).flat().map(m => m.id));
  const submittedUserIds = new Set((submissionsResult.data ?? []).map((s: any) => s.user_id).filter((id: string) => allMemberIdsSet.has(id)));
  
  // Identify Web users
  const webPicksEarliest = new Map<string, Date>();
  (webPicksResult.data || []).forEach((p: any) => {
    if (!p.created_at) return;
    const key = `${p.user_id}:${p.gw}`;
    const pickTime = new Date(p.created_at);
    const existing = webPicksEarliest.get(key);
    if (!existing || pickTime < existing) {
      webPicksEarliest.set(key, pickTime);
    }
  });
  
  const appPicksEarliest = new Map<string, Date>();
  (appPicksResult.data || []).forEach((p: any) => {
    if (!p.created_at) return;
    const key = `${p.user_id}:${p.gw}`;
    const pickTime = new Date(p.created_at);
    const existing = appPicksEarliest.get(key);
    if (!existing || pickTime < existing) {
      appPicksEarliest.set(key, pickTime);
    }
  });
  
  const appTestUserIds = new Set(APP_ONLY_USER_IDS);
  const webUserIds = new Set<string>();
  
  webPicksEarliest.forEach((webTime, key) => {
    const [userId, gwStr] = key.split(':');
    const gwNum = parseInt(gwStr, 10);
    if (gwNum !== currentGw) return;
    const appTime = appPicksEarliest.get(key);
    if (appTime && (webTime.getTime() - appTime.getTime()) < -500) {
      if (allMemberIdsSet.has(userId) && !appTestUserIds.has(userId)) {
        webUserIds.add(userId);
      }
    }
  });
  
  // Calculate league start GWs (used to bound picks query)
  const leagueStartGws = new Map<string, number>();
  const leagueStartGwPromises = leagues.map(async (league) => {
    const leagueStartGw = await resolveLeagueStartGw(league, gw);
    return { leagueId: league.id, leagueStartGw };
  });
  const leagueStartGwResults = await Promise.all(leagueStartGwPromises);
  leagueStartGwResults.forEach(({ leagueId, leagueStartGw }) => {
    leagueStartGws.set(leagueId, leagueStartGw);
  });

  // Fetch ALL picks for ALL ML members (bounded), then derive:
  // - season chip order (from full set)
  // - current GW rows/tables (from current GW slice)
  const allMemberIds = Array.from(allMemberIdsSet);
  const boundedStartGw = (() => {
    const starts = Array.from(leagueStartGws.values())
      .map((v) => (typeof v === 'number' ? v : 1))
      // 0 means "include all relevant GWs"; treat as 1 for bounding.
      .map((v) => (v <= 0 ? 1 : v))
      // 999 is API Test sentinel; don't use it as min bound.
      .filter((v) => v !== 999);
    return starts.length ? Math.min(...starts) : 1;
  })();
  const boundedEndGw = Math.max(
    typeof latestGw === 'number' && latestGw > 0 ? latestGw : currentGw,
    currentGw
  );

  let allMemberPicks: PickRow[] = [];
  if (allMemberIds.length > 0) {
    // Use paging to avoid silent truncation on large accounts / long seasons.
    // In typical cases (few leagues), this will complete in a single request.
    // NOTE: PostgREST commonly caps responses to ~1000 rows unless paged correctly.
    // Using PAGE_SIZE=1000 ensures our loop continues until all rows are fetched.
    const PAGE_SIZE = 1000;
    let from = 0;
    // Important: range() requires a deterministic order.
    // (We don't actually care about order, but we need stable paging.)
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const pageResult = await supabase
        .from('app_picks')
        .select('user_id, gw, fixture_index, pick')
        .in('user_id', allMemberIds)
        .gte('gw', boundedStartGw)
        .lte('gw', boundedEndGw)
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to);

      logDataFetch(
        'loadHomePageData',
        'Fetch all ML member picks (bounded paged)',
        'app_picks',
        pageResult,
        { memberCount: allMemberIds.length, gwRange: `${boundedStartGw}-${boundedEndGw}`, from, to, leaguesCount: leagues.length, userId }
      );

      if (pageResult.error) break;
      const page = (pageResult.data ?? []) as PickRow[];
      if (page.length === 0) break;
      allMemberPicks.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  // Index picks by user for efficient per-league aggregation
  const picksByUserId = new Map<string, PickRow[]>();
  allMemberPicks.forEach((p) => {
    const arr = picksByUserId.get(p.user_id) ?? [];
    arr.push(p);
    picksByUserId.set(p.user_id, arr);
  });

  // Picks per league (ALL GWs) for season ordering calculations
  const picksByLeague = new Map<string, PickRow[]>();
  leagues.forEach((league) => {
    const memberIds = (membersByLeague[league.id] ?? []).map((m) => m.id);
    const picks: PickRow[] = [];
    memberIds.forEach((id) => {
      const userPicks = picksByUserId.get(id);
      if (userPicks?.length) picks.push(...userPicks);
    });
    picksByLeague.set(league.id, picks);
  });

  // Build leaguePicks object (for current GW only)
  const leaguePicks: Record<string, PickRow[]> = {};
  picksByLeague.forEach((picks, leagueId) => {
    leaguePicks[leagueId] = picks.filter((p) => p.gw === currentGw);
  });
  
  // Build leagueSubmissionsSet (extract submitted user IDs per league)
  const leagueSubmissionsSet: Record<string, Set<string>> = {};
  leagues.forEach(league => {
    const memberIds = (membersByLeague[league.id] ?? []).map(m => m.id);
    const submitted = new Set(memberIds.filter(id => submittedUserIds.has(id)));
    leagueSubmissionsSet[league.id] = submitted;
  });
  
  // Calculate table rows for each league (for current GW only) - like lastGwRank calculation
  const leagueRows: Record<string, MLTableRow[]> = {};
  const currentGwResults = results.filter(r => r.gw === currentGw);
  const currentGwOutcomes = new Map<number, "H" | "D" | "A">();
  currentGwResults.forEach(r => {
    const out = rowToOutcome(r);
    if (out) currentGwOutcomes.set(r.fixture_index, out);
  });
  
  console.log('[loadHomePageData] Calculating leagueRows for GW', currentGw, {
    totalResults: results.length,
    currentGwResults: currentGwResults.length,
    leaguesCount: leagues.length,
  });
  
  leagues.forEach(league => {
    const members = membersByLeague[league.id] ?? [];
    const picks = leaguePicks[league.id] ?? [];
    const submissions = leagueSubmissionsSet[league.id] ?? new Set<string>();
    
    console.log(`[loadHomePageData] League ${league.id} (${league.name}):`, {
      membersCount: members.length,
      picksCount: picks.length,
      submissionsCount: submissions.size,
      submissions: Array.from(submissions),
    });
    
    // Only include members who submitted
    const rows: MLTableRow[] = members
      .filter(m => submissions.has(m.id))
      .map(m => ({
        user_id: m.id,
        name: m.name,
        score: 0,
        unicorns: 0,
      }));
    
    console.log(`[loadHomePageData] League ${league.id} initial rows:`, rows.length);
    
    // Group picks by fixture
    const picksByFixture = new Map<number, Array<{ user_id: string; pick: "H" | "D" | "A" }>>();
    picks.forEach(p => {
      if (p.gw !== currentGw) return;
      if (!submissions.has(p.user_id)) return;
      const arr = picksByFixture.get(p.fixture_index) ?? [];
      arr.push({ user_id: p.user_id, pick: p.pick });
      picksByFixture.set(p.fixture_index, arr);
    });
    
    // Calculate scores
    currentGwOutcomes.forEach((outcome, fixtureIndex) => {
      const thesePicks = picksByFixture.get(fixtureIndex) ?? [];
      const correctIds = thesePicks.filter(p => p.pick === outcome).map(p => p.user_id);
      
      correctIds.forEach(uid => {
        const row = rows.find(r => r.user_id === uid);
        if (row) row.score += 1;
      });
      
      // Unicorns: only one person got it right AND at least 3 members submitted
      if (correctIds.length === 1 && submissions.size >= 3) {
        const row = rows.find(r => r.user_id === correctIds[0]);
        if (row) row.unicorns += 1;
      }
    });
    
    // Sort: score desc, unicorns desc, name asc
    rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name));
    leagueRows[league.id] = rows;
    
    console.log(`[loadHomePageData] League ${league.id} final rows:`, rows.length, rows.map(r => ({ name: r.name, score: r.score })));
  });
  
  console.log('[loadHomePageData] Final leagueRows:', Object.keys(leagueRows).length, 'leagues');

  const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(":")[0], 10)))].sort((a, b) => a - b);
  
  // Process league data
  const leagueDataMap: Record<string, LeagueDataInternal> = {};
  const submissionStatus: Record<string, { allSubmitted: boolean; submittedCount: number; totalCount: number }> = {};
  
  leagues.forEach(league => {
    const members = membersByLeague[league.id] ?? [];
    const memberIds = members.map(m => m.id);
    const submittedCount = memberIds.filter(id => submittedUserIds.has(id)).length;
    const totalCount = memberIds.length;
    
    submissionStatus[league.id] = {
      allSubmitted: submittedCount === totalCount && totalCount > 0,
      submittedCount,
      totalCount
    };
    
    if (outcomeByGwIdx.size === 0) {
      const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
      leagueDataMap[league.id] = {
        id: league.id,
        members: sortedMembers,
        userPosition: null,
        positionChange: null,
        submittedMembers: new Set(memberIds.filter(id => submittedUserIds.has(id))),
        sortedMemberIds: sortedMembers.map(m => m.id),
        latestGwWinners: new Set<string>(),
        latestRelevantGw: null,
        webUserIds: new Set(memberIds.filter(id => webUserIds.has(id)))
      };
      return;
    }
    
    const leagueStartGw = leagueStartGws.get(league.id) ?? gw;
    const currentGwFinished = gwsWithResults.includes(gw);
    const allRelevantGws = leagueStartGw === 0 
      ? gwsWithResults 
      : gwsWithResults.filter(g => g >= leagueStartGw);
    const relevantGws = currentGwFinished && !allRelevantGws.includes(gw)
      ? [...allRelevantGws, gw].sort((a, b) => a - b)
      : allRelevantGws;
    
    if (relevantGws.length === 0) {
      const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
      leagueDataMap[league.id] = {
        id: league.id,
        members: sortedMembers,
        userPosition: null,
        positionChange: null,
        submittedMembers: new Set(memberIds.filter(id => submittedUserIds.has(id))),
        sortedMemberIds: sortedMembers.map(m => m.id),
        latestGwWinners: new Set<string>(),
        latestRelevantGw: null,
        webUserIds: new Set(memberIds.filter(id => webUserIds.has(id)))
      };
      return;
    }
    
    const allPicks = picksByLeague.get(league.id) ?? [];
    const relevantGwsSet = new Set(relevantGws);
    const picksAll = allPicks.filter(p => relevantGwsSet.has(p.gw));
    
      const outcomeByGwAndIdx = new Map<number, Map<number, "H" | "D" | "A">>();
    relevantGws.forEach((g) => {
      outcomeByGwAndIdx.set(g, new Map<number, "H" | "D" | "A">());
    });
    outcomeByGwIdx.forEach((out: "H" | "D" | "A", key: string) => {
      const [gwStr, idxStr] = key.split(":");
      const g = parseInt(gwStr, 10);
      const idx = parseInt(idxStr, 10);
      if (relevantGwsSet.has(g)) {
        outcomeByGwAndIdx.get(g)?.set(idx, out);
      }
    });
    
    const perGw = new Map<number, Map<string, { user_id: string; score: number; unicorns: number }>>();
    const gwWinners = new Map<number, Set<string>>();
    
    relevantGws.forEach((g) => {
      const map = new Map<string, { user_id: string; score: number; unicorns: number }>();
      members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
      perGw.set(g, map);
    });
    
    const picksByGwIdx = new Map<string, PickRow[]>();
    picksAll.forEach((p: PickRow) => {
      const key = `${p.gw}:${p.fixture_index}`;
      const arr = picksByGwIdx.get(key) ?? [];
      arr.push(p);
      picksByGwIdx.set(key, arr);
    });
    
    const memberIdsSet = new Set(members.map(m => m.id));
    
    relevantGws.forEach((g) => {
      const gwOutcomes = outcomeByGwAndIdx.get(g)!;
      const map = perGw.get(g)!;
      
      gwOutcomes.forEach((out: "H" | "D" | "A", idx: number) => {
        const key = `${g}:${idx}`;
        const thesePicks = (picksByGwIdx.get(key) ?? []).filter((p: PickRow) => memberIdsSet.has(p.user_id));
        const correctUsers: string[] = [];
        
        thesePicks.forEach((p: PickRow) => {
          if (p.pick === out) {
            const row = map.get(p.user_id);
            if (row) {
              row.score += 1;
              correctUsers.push(p.user_id);
            }
          }
        });
        
        if (correctUsers.length === 1 && members.length >= 3) {
          const row = map.get(correctUsers[0]);
          if (row) row.unicorns += 1;
        }
      });
    });
    
    const mltPts = new Map<string, number>();
    const ocp = new Map<string, number>();
    const unis = new Map<string, number>();
    members.forEach((m) => {
      mltPts.set(m.id, 0);
      ocp.set(m.id, 0);
      unis.set(m.id, 0);
    });
    
    relevantGws.forEach((g) => {
      const gwRows: Array<{ user_id: string; score: number; unicorns: number }> = Array.from(perGw.get(g)!.values());
      gwRows.forEach((r) => {
        ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
        unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
      });
      
      gwRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
      if (gwRows.length === 0) return;
      
      const top = gwRows[0];
      const coTop = gwRows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
      const winners = new Set(coTop.map((r) => r.user_id));
      gwWinners.set(g, winners);
      
      if (coTop.length === 1) {
        mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
      } else {
        coTop.forEach((r) => {
          mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
        });
      }
    });
    
    const mltRows = members.map((m) => ({
      user_id: m.id,
      name: m.name,
      mltPts: mltPts.get(m.id) ?? 0,
      unicorns: unis.get(m.id) ?? 0,
      ocp: ocp.get(m.id) ?? 0,
    }));
    
    const sortedMltRows = [...mltRows].sort((a, b) => 
      b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name)
    );
    
    const sortedMemberIds = sortedMltRows.map(r => r.user_id);
    const userIndex = sortedMltRows.findIndex(r => r.user_id === userId);
    const userPosition = userIndex !== -1 ? userIndex + 1 : null;
    
    const latestRelevantGw = relevantGws.length ? Math.max(...relevantGws) : null;
    const latestGwWinners = latestRelevantGw !== null ? (gwWinners.get(latestRelevantGw) ?? new Set<string>()) : new Set<string>();
    const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
    
    const leagueWebUserIds = new Set(memberIds.filter(id => webUserIds.has(id)));
    
    leagueDataMap[league.id] = {
      id: league.id,
      members: sortedMembers,
      userPosition,
      positionChange: null,
      submittedMembers: new Set(memberIds.filter(id => submittedUserIds.has(id))),
      sortedMemberIds,
      latestGwWinners,
      latestRelevantGw,
      webUserIds: leagueWebUserIds
    };

  });
  
  // Cache the data
  try {
    setCached(basicCacheKey, {
      currentGw: gw,
      latestGw,
      allGwPoints,
      overall,
      lastGwRank,
      fiveGwRank,
      tenGwRank,
      seasonRank,
    }, CACHE_TTL.HOME);
    
    setCached(fixturesCacheKey, {
      fixtures,
      userPicks,
    }, CACHE_TTL.HOME);
    
    const cacheableLeagueData: Record<string, any> = {};
    for (const [leagueId, data] of Object.entries(leagueDataMap)) {
      cacheableLeagueData[leagueId] = {
        ...data,
        submittedMembers: Array.from(data.submittedMembers).sort(),
        latestGwWinners: Array.from(data.latestGwWinners).sort(),
        webUserIds: Array.from(data.webUserIds).sort(),
      };
    }
    
    // Cache leaguePicks, leagueSubmissionsSet, and leagueRows
    const cacheableLeaguePicks: Record<string, PickRow[]> = {};
    const cacheableLeagueSubmissionsSet: Record<string, string[]> = {};
    for (const leagueId in leaguePicks) {
      cacheableLeaguePicks[leagueId] = leaguePicks[leagueId];
    }
    for (const leagueId in leagueSubmissionsSet) {
      cacheableLeagueSubmissionsSet[leagueId] = Array.from(leagueSubmissionsSet[leagueId]);
    }
    
    setCached(leagueDataCacheKey, {
      leagueData: cacheableLeagueData,
      leagueSubmissions: submissionStatus,
      leaguePicks: cacheableLeaguePicks,
      leagueSubmissionsSet: cacheableLeagueSubmissionsSet,
      leagueRows: leagueRows, // Pre-calculated rows
    }, CACHE_TTL.HOME);
  } catch (error) {
    // Failed to cache (non-critical)
  }
  
  return {
    gw,
    latestGw,
    fixtures,
    userPicks,
    leagueData: leagueDataMap,
    leagueSubmissions: submissionStatus,
    leaguePicks,
    leagueSubmissionsSet,
    leagueRows, // Pre-calculated table rows
    gwPoints: allGwPoints.filter(gp => gp.user_id === userId),
    allGwPoints,
    overall,
    lastGwRank,
    fiveGwRank,
    tenGwRank,
    seasonRank,
  };
}

