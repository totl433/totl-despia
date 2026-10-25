import { computeLiveGwScoresForGw, rankUserInGwLiveScores } from './liveGwScores.js';
import { resolveLeagueStartGw } from './leagueStart.js';
import { upsertSubscriber, unsubscribeSubscriber } from './mailerlite.js';
import {
  countTrailingPlayedWeeks,
  isLeftoverPriorSeasonLastCompleted,
  playedGwSet,
  resolveStatsHeadlineGws,
} from './profileStatsHeadline.js';
import { applySeasonFilter, getSeasonTables, resolveSeasonCtx } from './seasonStack.js';

const ADMIN_IDS = new Set<string>([
  // Founders
  '4542c037-5b38-40d0-b189-847b8f17c222',
  '36f31625-6d6c-4aa4-815a-1493a812841b',
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2',
  '9c0bcf50-370d-412d-8826-95371a72b4fe',
]);

export function isTotlAdmin(userId: string): boolean {
  return ADMIN_IDS.has(userId);
}

function calculatePercentile(userValue: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const rank = allValues.filter((v) => v <= userValue).length;
  const percentile = (rank / allValues.length) * 100;
  return Math.round(percentile * 100) / 100;
}

/** Football API ids often arrive as numeric strings from PostgREST — strict `typeof === 'number'` misses joins. */
function parseFiniteApiMatchId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

/** Supabase/PostgREST caps rows (~1000); leaderboard screens page — profile stats must too or GW totals truncate. */
async function fetchAllRowsPaged<T>(
  runPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await runPage(from, to);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/** Index live score rows by gw:fixture_index and by api_match_id (covers rows with null gw from ingest). */
function mergeLiveScoreRowsIntoMaps(
  rows: any[],
  liveByGwFi: Map<string, any>,
  liveByApiMatchId: Map<number, any>
) {
  rows.forEach((row: any) => {
    const gwN = Number(row.gw);
    const fiN = Number(row.fixture_index);
    if (Number.isFinite(gwN) && Number.isFinite(fiN)) liveByGwFi.set(`${gwN}:${fiN}`, row);
    const lid = parseFiniteApiMatchId(row.api_match_id);
    if (lid != null) liveByApiMatchId.set(lid, row);
  });
}

type UserPickRow = { gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' };

/** Normalize DB pick strings so comparisons match `app_gw_results` letters. */
function normalizePickLetter(pick: unknown): 'H' | 'D' | 'A' | null {
  const s = typeof pick === 'string' ? pick.trim().toUpperCase() : '';
  if (s === 'H' || s === 'D' || s === 'A') return s;
  return null;
}

function groupFixtureRowsByGw(rows: any[]): Map<number, any[]> {
  const m = new Map<number, any[]>();
  rows.forEach((row: any) => {
    const g = Number(row.gw);
    if (!Number.isFinite(g)) return;
    const arr = m.get(g) ?? [];
    arr.push(row);
    m.set(g, arr);
  });
  return m;
}

/** Web `fixtures` vs `app_fixtures` code normalization (mirror triggers). */
function normWebCodeForAppMatch(code: string | null | undefined): string | null {
  if (typeof code !== 'string' || !code.trim()) return null;
  const c = code.trim().toUpperCase();
  return c === 'NFO' ? 'NOT' : c;
}

function normAppCodeRaw(code: string | null | undefined): string | null {
  if (typeof code !== 'string' || !code.trim()) return null;
  return code.trim().toUpperCase();
}

/**
 * TLAs we accept as Premier League when joining picks → `app_fixtures`.
 * Keeps Champions League / etc. rows (PAR, PSV, …) from corrupting team stats when they share `gw` buckets.
 * Includes relegated clubs so older gameweeks still resolve.
 */
const PREMIER_LEAGUE_TEAM_CODES = new Set<string>([
  'ARS',
  'AVL',
  'BOU',
  'BRE',
  'BHA',
  'BUR',
  'CHE',
  'CRY',
  'EVE',
  'FUL',
  'HUL',
  'IPS',
  'COV',
  'LEE',
  'LEI',
  'LIV',
  'MCI',
  'MUN',
  'NEW',
  'NFO',
  'SOU',
  'SUN',
  'TOT',
  'WHU',
  'WOL',
]);

function canonicalPremierTeamCode(code: string | null | undefined): string | null {
  const c = normAppCodeRaw(code);
  if (!c) return null;
  return c === 'NOT' ? 'NFO' : c;
}

/** Stable labels for stats cards (never trust `app_fixtures` names when rows can be corrupted). */
const PREMIER_CODE_DISPLAY_NAME: Record<string, string> = {
  ARS: 'Arsenal',
  AVL: 'Aston Villa',
  BOU: 'Bournemouth',
  BRE: 'Brentford',
  BHA: 'Brighton',
  BUR: 'Burnley',
  CHE: 'Chelsea',
  CRY: 'Crystal Palace',
  EVE: 'Everton',
  FUL: 'Fulham',
  HUL: 'Hull',
  IPS: 'Ipswich',
  COV: 'Coventry',
  LEE: 'Leeds United',
  LEI: 'Leicester City',
  LIV: 'Liverpool',
  MCI: 'Man City',
  MUN: 'Man United',
  NEW: 'Newcastle',
  NFO: "Nott'm Forest",
  SOU: 'Southampton',
  SUN: 'Sunderland',
  TOT: 'Spurs',
  WHU: 'West Ham',
  WOL: 'Wolves',
};

/** Club labels we never treat as Premier League fixtures (UCL / other comps accidentally keyed like PL rows). */
const NON_PREMIER_CLUB_NAME_MARKERS = [
  'paris saint-germain',
  'paris saint germain',
  'psv',
  'psv eindhoven',
  'bayern',
  'borussia',
  'fc bayern',
  'barcelona',
  'fc barcelona',
  'real madrid',
  'atlético de madrid',
  'atletico de madrid',
  'atlético madrid',
  'atletico madrid',
  'juventus',
  'inter milan',
  'fc internazionale',
  'ac milan',
  'ssc napoli',
  'napoli',
  'sl benfica',
  'benfica',
  'fc porto',
  'fc schalke',
  'ajax',
  'feyenoord',
  'club brugge',
  'galatasaray',
  'fenerbahçe',
  'sporting cp',
  'fc salzburg',
  'rb leipzig',
  'bayer leverkusen',
  'eintracht frankfurt',
  'olympique',
  'as monaco',
  'lyonnais',
  'lyon',
  'marseille',
];

function normalizedFixtureClubBlob(f: {
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  home_team?: string | null;
  away_team?: string | null;
}): string {
  const parts = [
    f.home_code,
    f.away_code,
    f.home_name,
    f.away_name,
    f.home_team,
    f.away_team,
  ]
    .map((x) =>
      String(x ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
    )
    .filter(Boolean);
  return parts.join(' | ');
}

function fixtureReferencesKnownNonPremierClub(f: {
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  home_team?: string | null;
  away_team?: string | null;
}): boolean {
  const blob = normalizedFixtureClubBlob(f);
  if (!blob) return false;
  return NON_PREMIER_CLUB_NAME_MARKERS.some((m) => blob.includes(m));
}

function fixtureRowIsPremierLeague(f: {
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  home_team?: string | null;
  away_team?: string | null;
}): boolean {
  const h = canonicalPremierTeamCode(f.home_code);
  const a = canonicalPremierTeamCode(f.away_code);
  if (!h || !a) return false;
  if (!PREMIER_LEAGUE_TEAM_CODES.has(h) || !PREMIER_LEAGUE_TEAM_CODES.has(a)) return false;
  if (fixtureReferencesKnownNonPremierClub(f)) return false;
  return true;
}

function webAppFixtureSamePair(
  w: { home_code?: string | null; away_code?: string | null; home_name?: string | null; away_name?: string | null },
  a: { home_code?: string | null; away_code?: string | null; home_name?: string | null; away_name?: string | null }
): boolean {
  const wh = normWebCodeForAppMatch(w.home_code);
  const wa = normWebCodeForAppMatch(w.away_code);
  const ah = normAppCodeRaw(a.home_code);
  const aa = normAppCodeRaw(a.away_code);
  if (wh && wa && ah && aa) {
    return (wh === ah && wa === aa) || (wh === aa && wa === ah);
  }
  const wnh = typeof w.home_name === 'string' ? w.home_name.trim().toLowerCase() : '';
  const wna = typeof w.away_name === 'string' ? w.away_name.trim().toLowerCase() : '';
  const anh = typeof a.home_name === 'string' ? a.home_name.trim().toLowerCase() : '';
  const ana = typeof a.away_name === 'string' ? a.away_name.trim().toLowerCase() : '';
  const webCodesMissing = !wh || !wa;
  if (webCodesMissing && wnh && wna && anh && ana) {
    return (wnh === anh && wna === ana) || (wnh === ana && wna === anh);
  }
  return false;
}

/** Map web `fixtures.fixture_index` → app `fixture_index` by pairing teams. */
function buildWebToAppFixtureIndexMap(webFx: any[], appFx: any[]): Map<number, number> {
  const m = new Map<number, number>();
  webFx.forEach((w) => {
    const wi = Number(w.fixture_index);
    if (!Number.isFinite(wi) || m.has(wi)) return;
    for (const a of appFx) {
      const ai = Number(a.fixture_index);
      if (!Number.isFinite(ai)) continue;
      if (webAppFixtureSamePair(w, a)) {
        m.set(wi, ai);
        return;
      }
    }
    m.set(wi, wi);
  });
  return m;
}

/** Legacy `picks` rows may use web `fixture_index`; map through web↔app schedules when both exist. */
function remapLegacyPicksToAppFixtureIndices(
  legacyRows: Array<{ gw: number; fixture_index: number; pick: string }>,
  webByGw: Map<number, any[]>,
  appByGw: Map<number, any[]>
): UserPickRow[] {
  const legByGw = new Map<number, Array<{ gw: number; fixture_index: number; pick: string }>>();
  legacyRows.forEach((p) => {
    const g = Number(p.gw);
    if (!Number.isFinite(g)) return;
    const arr = legByGw.get(g) ?? [];
    arr.push(p);
    legByGw.set(g, arr);
  });

  const out: UserPickRow[] = [];
  legByGw.forEach((rows, gw) => {
    const webFx = webByGw.get(gw) ?? [];
    const appFx = appByGw.get(gw) ?? [];
    const fiMap =
      webFx.length > 0 && appFx.length > 0 ? buildWebToAppFixtureIndexMap(webFx, appFx) : new Map<number, number>();
    rows.forEach((p) => {
      const rawFi = Number(p.fixture_index);
      const pick = normalizePickLetter(p.pick);
      if (!Number.isFinite(rawFi) || !pick) return;
      const appFi = fiMap.get(rawFi) ?? rawFi;
      out.push({ gw, fixture_index: appFi, pick });
    });
  });
  return out;
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

  const seasonCtx = await resolveSeasonCtx(supa as any, userId);

  const [userRowRes, ocpRes, leaguesCountRes, latestGwRes, gwPointsRes, submissionsRes, authRes, runtimeRes] =
    await Promise.all([
      (supa as any).from('users').select('name, avatar_url').eq('id', userId).maybeSingle(),
      (supa as any).from('app_v_ocp_overall').select('ocp').eq('user_id', userId).maybeSingle(),
      (supa as any).from('league_members').select('league_id', { count: 'exact', head: true }).eq('user_id', userId),
      (supa as any).from('app_gw_results').select('gw').order('gw', { ascending: false }).limit(1).maybeSingle(),
      (supa as any).from('app_v_gw_points').select('gw').eq('user_id', userId),
      (supa as any).from('app_gw_submissions').select('gw').eq('user_id', userId),
      (rootSupabase as any).auth.getUser(accessToken),
      (supa as any).from('app_season_runtime').select('current_season_id, current_gw').eq('id', 1).maybeSingle(),
    ]);

  if (userRowRes.error) throw userRowRes.error;
  if (ocpRes.error) throw ocpRes.error;
  if (leaguesCountRes.error) throw leaguesCountRes.error;
  if (latestGwRes.error) throw latestGwRes.error;
  if (gwPointsRes.error) throw gwPointsRes.error;
  if (submissionsRes.error) throw submissionsRes.error;
  if (authRes.error) throw authRes.error;

  const seasonId =
    (seasonCtx.useSeasonStack && seasonCtx.seasonId) ||
    (typeof runtimeRes.data?.current_season_id === 'string' ? runtimeRes.data.current_season_id : null) ||
    seasonCtx.seasonId ||
    null;

  let seasonOcp = 0;
  const seasonPlayed = new Set<number>();
  let seasonThroughGw = 0;

  if (seasonId) {
    const [seasonOcpRes, seasonPointsRes, seasonSubsRes, seasonLastRes] = await Promise.all([
      (supa as any)
        .from('app_v_season_ocp_overall')
        .select('ocp')
        .eq('user_id', userId)
        .eq('season_id', seasonId)
        .maybeSingle(),
      (supa as any).from('app_v_season_gw_points').select('gw').eq('user_id', userId).eq('season_id', seasonId),
      (supa as any).from('app_season_submissions').select('gw').eq('user_id', userId).eq('season_id', seasonId),
      (supa as any)
        .from('app_season_results')
        .select('gw')
        .eq('season_id', seasonId)
        .order('gw', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (seasonOcpRes.error) throw seasonOcpRes.error;
    if (seasonPointsRes.error) throw seasonPointsRes.error;
    if (seasonSubsRes.error) throw seasonSubsRes.error;
    if (seasonLastRes.error) throw seasonLastRes.error;
    seasonOcp = Number(seasonOcpRes.data?.ocp ?? 0);
    playedGwSet(seasonPointsRes.data).forEach((gw) => seasonPlayed.add(gw));
    playedGwSet(seasonSubsRes.data).forEach((gw) => seasonPlayed.add(gw));
    const last = Number(seasonLastRes.data?.gw ?? 0);
    seasonThroughGw = Number.isFinite(last) && last > 0 ? last : 0;
  }

  const priorPlayed = playedGwSet([...(gwPointsRes.data ?? []), ...(submissionsRes.data ?? [])]);
  let priorThroughGw = Number(latestGwRes.data?.gw ?? 0);
  if (!Number.isFinite(priorThroughGw) || priorThroughGw < 1) {
    priorThroughGw = priorPlayed.size ? Math.max(...priorPlayed) : 0;
  }
  if (priorThroughGw > CURRENT_CAMPAIGN_END_GW) priorThroughGw = CURRENT_CAMPAIGN_END_GW;

  const weeksStreak = countTrailingPlayedWeeks([
    { played: priorPlayed, throughGw: priorThroughGw },
    { played: seasonPlayed, throughGw: seasonThroughGw },
  ]);

  const name = (userRowRes.data?.name as string | null) ?? 'User';
  const email = (authRes.data?.user?.email as string | null) ?? null;

  const out: ProfileSummary = {
    name,
    email,
    avatar_url: (userRowRes.data?.avatar_url as string | null) ?? null,
    isAdmin: ADMIN_IDS.has(userId),
    ocp: Number(ocpRes.data?.ocp ?? 0) + seasonOcp,
    miniLeaguesCount: Number(leaguesCountRes.count ?? 0),
    weeksStreak,
  };

  return out;
}

export type UserStatsData = {
  lastCompletedGw: number | null;
  highlightGw?: number | null;
  lastCompletedGwPercentile: number | null;
  overallPercentile: number | null;
  correctPredictionRate: number | null;
  correctPredictionFieldAvgPct: number | null;
  correctPredictionVsField: 'above' | 'below' | 'about' | null;
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
  gameweekStreak: Array<{ gw: number; points: number | null; seasonLabel?: string }> | null;
  trophyCabinet: { gameweekPodiums: number; monthlyPodiums: number; seasonPodiums: number } | null;
  lastSeasonChampions: { seasonLabel: string; names: string[] } | null;
};

/** Keep in sync with `apps/mobile/src/lib/leaderboardMonths.ts` SEASON_2025_26 ranges. */
const LEADERBOARD_MONTH_BUCKETS: ReadonlyArray<{ startGw: number; endGw: number }> = [
  { startGw: 1, endGw: 3 },
  { startGw: 4, endGw: 7 },
  { startGw: 8, endGw: 10 },
  { startGw: 11, endGw: 13 },
  { startGw: 14, endGw: 18 },
  { startGw: 19, endGw: 22 },
  { startGw: 23, endGw: 28 },
  { startGw: 29, endGw: 31 },
  { startGw: 32, endGw: 35 },
  { startGw: 36, endGw: 38 },
];

const CURRENT_CAMPAIGN_END_GW = 38;
const SEASON_2025_26_LABEL = '2025/26';
const SEASON_2026_27_LABEL = '2026/27';

const LEADERBOARD_MONTH_BUCKETS_2026_27: ReadonlyArray<{ startGw: number; endGw: number }> = [
  { startGw: 1, endGw: 2 },
  { startGw: 3, endGw: 5 },
  { startGw: 6, endGw: 9 },
  { startGw: 10, endGw: 12 },
  { startGw: 13, endGw: 18 },
  { startGw: 19, endGw: 23 },
  { startGw: 24, endGw: 27 },
  { startGw: 28, endGw: 30 },
  { startGw: 31, endGw: 33 },
  { startGw: 34, endGw: 38 },
];

function parsePreviousSeasonChampionsFromEnv(): { seasonLabel: string; names: string[] } | null {
  const raw =
    typeof process.env.PREVIOUS_SEASON_CHAMPIONS_JSON === 'string'
      ? process.env.PREVIOUS_SEASON_CHAMPIONS_JSON.trim()
      : '';
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { seasonLabel?: unknown; names?: unknown };
    if (typeof o.seasonLabel !== 'string' || !Array.isArray(o.names)) return null;
    const names = o.names.filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
    return { seasonLabel: o.seasonLabel.trim(), names };
  } catch {
    return null;
  }
}

/**
 * Merge finalized results with live score outcomes for one GW (same logic as GlobalScreen
 * gwLiveFallbackScores). `app_v_gw_points` only sees `app_gw_results`; during live GWs the
 * leaderboard shows reconstructed scores — streak chips must match.
 */
function outcomesForGwFromResultsLive(args: {
  gw: number;
  resultsRows: Array<{
    gw?: number;
    fixture_index?: number;
    result?: string | null;
    home_score?: number | null;
    away_score?: number | null;
  }>;
  fixturesRows: Array<{ gw?: number; fixture_index?: number; api_match_id?: number | null }>;
  liveRows: Array<{
    gw?: number;
    api_match_id?: number | null;
    fixture_index?: number | null;
    home_score?: number | null;
    away_score?: number | null;
    status?: string | null;
  }>;
}): Map<number, 'H' | 'D' | 'A'> {
  const { gw, resultsRows, fixturesRows, liveRows } = args;
  const outcomeByFixtureIndex = new Map<number, 'H' | 'D' | 'A'>();
  resultsRows.forEach((r) => {
    if (Number(r.gw) !== gw) return;
    const fi = Number(r.fixture_index);
    if (!Number.isFinite(fi)) return;
    let res = r.result;
    if (res === 'H' || res === 'D' || res === 'A') {
      outcomeByFixtureIndex.set(fi, res);
      return;
    }
    const hs = r.home_score;
    const as = r.away_score;
    if (typeof hs === 'number' && typeof as === 'number') {
      outcomeByFixtureIndex.set(fi, hs > as ? 'H' : hs < as ? 'A' : 'D');
    }
  });
  const apiMatchIdToFixture = new Map<number, number>();
  fixturesRows.forEach((f) => {
    if (Number(f.gw) !== gw) return;
    const aid = parseFiniteApiMatchId(f.api_match_id);
    const fi = Number(f.fixture_index);
    if (aid != null && Number.isFinite(fi)) apiMatchIdToFixture.set(aid, fi);
  });
  liveRows.forEach((ls) => {
    const status = ls.status;
    const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
    if (!started) return;
    let fixtureIndex: number | undefined;
    const fiLs = Number(ls.fixture_index);
    if (Number(ls.gw) === gw && Number.isFinite(fiLs)) fixtureIndex = fiLs;
    else {
      const mid = parseFiniteApiMatchId(ls.api_match_id);
      if (mid != null) fixtureIndex = apiMatchIdToFixture.get(mid);
    }
    if (typeof fixtureIndex !== 'number') return;
    const hs = Number(ls.home_score ?? 0);
    const as = Number(ls.away_score ?? 0);
    outcomeByFixtureIndex.set(fixtureIndex, hs > as ? 'H' : hs < as ? 'A' : 'D');
  });
  return outcomeByFixtureIndex;
}

function parseKickoffMs(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * True when the meta gameweek’s last scheduled fixture is FINISHED and nothing is IN_PLAY/PAUSED
 * (aligns with mobile `getGameweekStateFromSnapshot` → RESULTS_PRE_GW).
 * If there are no `app_fixtures` rows for `metaGw` in `fxRows`, returns true (caller skips narrowing).
 */
function isMetaGwFullyFinishedForStats(metaGw: number, fxRows: any[], liveRows: any[], now = new Date()): boolean {
  const rawFx = (fxRows ?? []).filter((f: any) => Number(f?.gw) === metaGw);
  if (rawFx.length === 0) return true;

  const fixturesWithKick = rawFx
    .map((f: any) => ({
      kick: parseKickoffMs(f?.kickoff_time),
      fixture_index: typeof f?.fixture_index === 'number' ? f.fixture_index : null,
      api_match_id: parseFiniteApiMatchId(f?.api_match_id),
    }))
    .filter((x): x is { kick: number; fixture_index: number | null; api_match_id: number | null } => x.kick != null)
    .sort((a, b) => a.kick - b.kick);

  if (fixturesWithKick.length === 0) return false;

  if (now.getTime() < fixturesWithKick[0]!.kick) return false;

  const liveAll = liveRows ?? [];
  const liveForGw = liveAll.filter((ls: any) => !Number.isFinite(Number(ls?.gw)) || Number(ls?.gw) === metaGw);
  if (liveForGw.some((ls: any) => ls?.status === 'IN_PLAY' || ls?.status === 'PAUSED')) return false;

  const last = fixturesWithKick[fixturesWithKick.length - 1]!;
  const lastFi = last.fixture_index;
  const lastAid = last.api_match_id;

  let lastLive: any = null;
  if (typeof lastFi === 'number') {
    lastLive =
      liveForGw.find((ls: any) => Number(ls?.fixture_index) === lastFi && Number(ls?.gw) === metaGw) ??
      liveForGw.find((ls: any) => Number(ls?.fixture_index) === lastFi) ??
      null;
  }
  if (!lastLive && lastAid != null) {
    lastLive =
      liveForGw.find((ls: any) => parseFiniteApiMatchId(ls?.api_match_id) === lastAid) ??
      liveAll.find((ls: any) => parseFiniteApiMatchId(ls?.api_match_id) === lastAid) ??
      null;
  }

  return lastLive?.status === 'FINISHED';
}

export async function getProfileStats(opts: { userId: string; supa: any }): Promise<UserStatsData> {
  const { userId, supa } = opts;

  type GwPointsUserRow = { user_id: string; gw: number; points: number };
  type GwPointsMeRow = { gw: number; points: number };

  const stats: UserStatsData = {
    lastCompletedGw: null,
    highlightGw: null,
    lastCompletedGwPercentile: null,
    overallPercentile: null,
    correctPredictionRate: null,
    correctPredictionFieldAvgPct: null,
    correctPredictionVsField: null,
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
    gameweekStreak: null,
    trophyCabinet: null,
    lastSeasonChampions: parsePreviousSeasonChampionsFromEnv(),
  };

  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const pileB = !!(seasonCtx.useSeasonStack && seasonCtx.seasonId);
  const tables = getSeasonTables({ useSeasonStack: pileB });
  const seasonFilter = pileB
    ? seasonCtx
    : { useSeasonStack: false as const, seasonId: null as string | null };
  const activeSeasonLabel =
    (typeof seasonCtx.seasonLabel === 'string' && seasonCtx.seasonLabel.trim()) ||
    (pileB ? SEASON_2026_27_LABEL : SEASON_2025_26_LABEL);

  const lastGwQ = applySeasonFilter(
    (supa as any).from(tables.results).select('gw').order('gw', { ascending: false }).limit(1),
    seasonFilter
  );
  const { data: lastGwData, error: lastGwErr } = await lastGwQ.maybeSingle();
  if (lastGwErr) throw lastGwErr;

  const rawLastCompletedGw = (lastGwData?.gw as number | null) ?? null;
  const metaGw = seasonCtx.currentGw > 0 ? seasonCtx.currentGw : null;
  const leftoverPriorSeason = !pileB && isLeftoverPriorSeasonLastCompleted(rawLastCompletedGw, metaGw);
  const headline = resolveStatsHeadlineGws({
    lastCompletedGw: leftoverPriorSeason ? null : rawLastCompletedGw,
    metaGw,
  });
  const lastCompletedGw = headline.lastCompletedGw;
  const highlightGw = headline.highlightGw;
  const historyLastCompletedGw = leftoverPriorSeason ? rawLastCompletedGw : lastCompletedGw;

  stats.lastCompletedGw = lastCompletedGw;
  stats.highlightGw = highlightGw;

  /** Omit live / future GW from pick-based aggregates (avoids “0 pts on GW36”, skewed chaos, etc.). */
  const statsEligibleGwCap =
    typeof lastCompletedGw === 'number' && lastCompletedGw > 0 ? lastCompletedGw : null;

  if (!lastCompletedGw && !metaGw) return stats;

  /** User picks from the active pile only — do not scan every historical GW’s live_scores/fixtures. */
  const myAppPicksPaged = await fetchAllRowsPaged<{ gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' }>(
    (from, to) =>
      applySeasonFilter(
        (supa as any)
          .from(tables.picks)
          .select('gw, fixture_index, pick')
          .eq('user_id', userId)
          .order('gw', { ascending: true })
          .order('fixture_index', { ascending: true })
          .range(from, to),
        seasonFilter
      )
  );

  let legacyPicksPaged: Array<{ gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' }> = [];
  if (!pileB) {
    const legacyTableProbe = await (supa as any).from('picks').select('gw').limit(1);
    if (!legacyTableProbe.error) {
      legacyPicksPaged = await fetchAllRowsPaged<{ gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' }>(
        (from, to) =>
          (supa as any)
            .from('picks')
            .select('gw, fixture_index, pick')
            .eq('user_id', userId)
            .order('gw', { ascending: true })
            .order('fixture_index', { ascending: true })
            .range(from, to)
      );
    } else if (legacyTableProbe.error?.code !== '42P01') {
      throw legacyTableProbe.error;
    }
  }

  /** Live + fixtures only for the active meta / last-completed week — not every old GW. */
  const gwForFxLiveFetch = new Set<number>();
  if (typeof metaGw === 'number' && metaGw > 0) gwForFxLiveFetch.add(metaGw);
  if (typeof lastCompletedGw === 'number' && lastCompletedGw > 0) gwForFxLiveFetch.add(lastCompletedGw);
  const pickGwsSortedForFetch = [...gwForFxLiveFetch].sort((a, b) => a - b);

  let livePickRows: Array<{
    gw?: number;
    api_match_id?: number | null;
    fixture_index?: number | null;
    home_score?: number | null;
    away_score?: number | null;
    status?: string | null;
  }> = [];
  let fxPickRows: any[] = [];

  const [resultsRowsFullData, liveFxBundle] = await Promise.all([
    fetchAllRowsPaged<{
      gw?: number;
      fixture_index?: number;
      result?: string | null;
      api_match_id?: number | null;
      home_score?: number | null;
      away_score?: number | null;
    }>((from, to) =>
      applySeasonFilter(
        (supa as any)
          .from(tables.results)
          .select('gw, fixture_index, result, api_match_id, home_score, away_score')
          .order('gw', { ascending: true })
          .order('fixture_index', { ascending: true })
          .range(from, to),
        seasonFilter
      )
    ),
    (async (): Promise<{
      live: Array<{
        gw?: number;
        api_match_id?: number | null;
        fixture_index?: number | null;
        home_score?: number | null;
        away_score?: number | null;
        status?: string | null;
      }>;
      fx: any[];
    }> => {
      if (pickGwsSortedForFetch.length === 0) return { live: [], fx: [] };
      const [livePickPaged, fxPickPaged] = await Promise.all([
        fetchAllRowsPaged<{
          gw?: number;
          api_match_id?: number | null;
          fixture_index?: number | null;
          home_score?: number | null;
          away_score?: number | null;
          status?: string | null;
        }>((from, to) =>
          (supa as any)
            .from('live_scores')
            .select('gw, api_match_id, fixture_index, home_score, away_score, status')
            .in('gw', pickGwsSortedForFetch)
            .order('gw', { ascending: true })
            .order('fixture_index', { ascending: true })
            .order('api_match_id', { ascending: true })
            .range(from, to)
        ),
        fetchAllRowsPaged<any>((from, to) =>
          applySeasonFilter(
            (supa as any)
              .from(tables.fixtures)
              .select(
                'gw, fixture_index, api_match_id, kickoff_time, home_code, away_code, home_name, away_name, home_team, away_team'
              )
              .in('gw', pickGwsSortedForFetch)
              .order('gw', { ascending: true })
              .order('fixture_index', { ascending: true })
              .order('api_match_id', { ascending: true })
              .range(from, to),
            seasonFilter
          )
        ),
      ]);
      return { live: livePickPaged, fx: fxPickPaged };
    })(),
  ]);

  livePickRows = liveFxBundle.live;
  fxPickRows = liveFxBundle.fx;

  /**
   * `app_gw_results` max `gw` can advance mid-week while the last fixture is still scheduled — treat that GW as
   * not finished for best/worst/avg/weekly par / pick-rate caps (same idea as mobile last-fixture FINISHED).
   */
  let finalizedStatsGwCap: number | null = statsEligibleGwCap;
  if (typeof metaGw === 'number' && metaGw > 0 && finalizedStatsGwCap != null && finalizedStatsGwCap >= metaGw) {
    const hasFxForMeta = (fxPickRows ?? []).some((f: any) => Number(f?.gw) === metaGw);
    if (hasFxForMeta && !isMetaGwFullyFinishedForStats(metaGw, fxPickRows, livePickRows)) {
      finalizedStatsGwCap = metaGw > 1 ? metaGw - 1 : null;
    }
  }

  const appFxByGwForRemap = groupFixtureRowsByGw(fxPickRows);

  let webFxRows: any[] = [];
  if (!pileB && legacyPicksPaged.length > 0) {
    const legacyGws = [...new Set(legacyPicksPaged.map((p) => Number(p.gw)).filter((n) => Number.isFinite(n)))].sort(
      (a, b) => a - b
    );
    try {
      webFxRows = await fetchAllRowsPaged<any>((from, to) =>
        (supa as any)
          .from('fixtures')
          .select('gw, fixture_index, home_code, away_code, home_name, away_name')
          .in('gw', legacyGws)
          .order('gw', { ascending: true })
          .order('fixture_index', { ascending: true })
          .range(from, to)
      );
    } catch (err: any) {
      if (err?.code !== '42P01') throw err;
    }
  }
  const webByGwForRemap = groupFixtureRowsByGw(webFxRows);

  const fixturesPerGwFromFx = new Map<number, number>();
  fxPickRows.forEach((f: any) => {
    const g = Number(f.gw);
    if (!Number.isFinite(g)) return;
    fixturesPerGwFromFx.set(g, (fixturesPerGwFromFx.get(g) ?? 0) + 1);
  });

  const appPicksNormalized: UserPickRow[] = [];
  for (const p of myAppPicksPaged) {
    const gw = Number(p.gw);
    const fi = Number(p.fixture_index);
    const pick = normalizePickLetter(p.pick);
    if (!Number.isFinite(gw) || !Number.isFinite(fi) || !pick) continue;
    appPicksNormalized.push({ gw, fixture_index: fi, pick });
  }

  const appPickCountByGw = new Map<number, number>();
  appPicksNormalized.forEach((p) => appPickCountByGw.set(p.gw, (appPickCountByGw.get(p.gw) ?? 0) + 1));

  /** Per GW: if app already has a full slate, legacy used different numbering — drop legacy for that GW. Otherwise merge (app overwrites same `gw:fi`). */
  const mergedPickByKey = new Map<string, UserPickRow>();
  for (const p of remapLegacyPicksToAppFixtureIndices(legacyPicksPaged, webByGwForRemap, appFxByGwForRemap)) {
    const fxListed = fixturesPerGwFromFx.get(p.gw) ?? 0;
    /** Premier League = 10 fixtures; if `fxPickRows` under-counted a GW, still require 10 app picks before ignoring legacy. */
    const fxNeed = Math.max(fxListed, 10);
    const appN = appPickCountByGw.get(p.gw) ?? 0;
    if (appN >= fxNeed) continue;
    mergedPickByKey.set(`${p.gw}:${p.fixture_index}`, p);
  }
  for (const p of appPicksNormalized) {
    mergedPickByKey.set(`${p.gw}:${p.fixture_index}`, p);
  }
  const allPicks = [...mergedPickByKey.values()];

  const gwForOutcomes = new Set<number>();
  allPicks.forEach((p) => {
    const g = Number(p.gw);
    if (Number.isFinite(g)) gwForOutcomes.add(g);
  });
  const pickGwsSorted = [...gwForOutcomes].sort((a, b) => a - b);

  const augmentedOutcomeByPickKey = new Map<string, 'H' | 'D' | 'A'>();
  const resultsRowsFull = resultsRowsFullData as Array<{
    gw?: number;
    fixture_index?: number;
    result?: string | null;
    api_match_id?: number | null;
    home_score?: number | null;
    away_score?: number | null;
  }>;
  pickGwsSorted.forEach((gw) => {
    const om = outcomesForGwFromResultsLive({
      gw,
      resultsRows: resultsRowsFull,
      fixturesRows: fxPickRows,
      liveRows: livePickRows,
    });
    om.forEach((res, fi) => augmentedOutcomeByPickKey.set(`${Number(gw)}:${Number(fi)}`, res));
  });

  let correct = 0;
  let total = 0;
  allPicks.forEach((p) => {
    const gw = Number(p.gw);
    if (finalizedStatsGwCap != null && Number.isFinite(gw) && gw > finalizedStatsGwCap) return;
    const res = augmentedOutcomeByPickKey.get(`${Number(p.gw)}:${Number(p.fixture_index)}`);
    if (!res) return;
    total++;
    if (p.pick === res) correct++;
  });
  if (total > 0) stats.correctPredictionRate = (correct / total) * 100;

  const liveScoresForMetaGwPromise =
    metaGw != null
      ? computeLiveGwScoresForGw(supa, metaGw, seasonCtx)
      : Promise.resolve([] as Array<{ user_id: string; score: number }>);

  const [{ data: submissionRows, error: subErr }, allGwPoints, liveScoresForMetaGw] = await Promise.all([
    applySeasonFilter(
      (supa as any).from(tables.submissions).select('gw').eq('user_id', userId),
      seasonFilter
    ),
    fetchAllRowsPaged<{ user_id: string; gw: number; points: number }>((from, to) =>
      applySeasonFilter(
        (supa as any)
          .from(tables.gwPoints)
          .select('user_id, gw, points')
          .order('gw', { ascending: true })
          .order('user_id', { ascending: true })
          .range(from, to),
        seasonFilter
      )
    ),
    liveScoresForMetaGwPromise,
  ]);
  if (subErr) throw subErr;

  let allGwPointsTyped = (allGwPoints ?? []).map((p: any) => ({
    user_id: String(p.user_id),
    gw: Number(p.gw),
    points: Number(p.points ?? 0),
  })) as GwPointsUserRow[];

  if (metaGw != null) {
    if (liveScoresForMetaGw.length > 0) {
      const scoreMap = new Map(liveScoresForMetaGw.map((r: { user_id: string; score: number }) => [r.user_id, r.score]));
      allGwPointsTyped = [
        ...allGwPointsTyped.filter((r) => r.gw !== metaGw),
        ...Array.from(scoreMap.entries()).map(([uid, points]) => ({ user_id: uid, gw: metaGw, points })),
      ];
    }
  }

  const ocpByUser = new Map<string, number>();
  allGwPointsTyped.forEach((p) => {
    ocpByUser.set(p.user_id, (ocpByUser.get(p.user_id) ?? 0) + p.points);
  });
  const ocpVals = Array.from(ocpByUser.values());
  if (ocpVals.length) {
    stats.overallPercentile = calculatePercentile(ocpByUser.get(userId) ?? 0, ocpVals);
  }

  const byGw = new Map<number, Array<{ user_id: string; points: number }>>();
  allGwPointsTyped.forEach((p) => {
    const arr = byGw.get(p.gw) ?? [];
    arr.push({ user_id: p.user_id, points: p.points });
    byGw.set(p.gw, arr);
  });

  if (highlightGw != null && !leftoverPriorSeason) {
    const ptsHi = byGw.get(highlightGw) ?? [];
    if (ptsHi.length) {
      const allPoints = ptsHi.map((x) => x.points);
      const userPts = ptsHi.find((x) => x.user_id === userId)?.points ?? 0;
      stats.lastCompletedGwPercentile = calculatePercentile(userPts, allPoints);
    }
  }

  const userGwPointsTyped = allGwPointsTyped
    .filter((p) => p.user_id === userId)
    .map((p) => ({ gw: p.gw, points: p.points }))
    .sort((a, b) => a.gw - b.gw) as GwPointsMeRow[];

  const submissionGwSet = new Set<number>(
    (submissionRows ?? []).map((r: any) => Number(r.gw)).filter((n: number) => Number.isFinite(n))
  );
  const pickGwSet = new Set<number>(
    allPicks.map((p) => Number(p.gw)).filter((n: number) => Number.isFinite(n))
  );

  const userPtsFromMergedView = new Map<number, number>(userGwPointsTyped.map((p) => [p.gw, p.points]));

  const resolveUserGwPoints = (gw: number): number => {
    if (userPtsFromMergedView.has(gw)) return userPtsFromMergedView.get(gw)!;
    let pts = 0;
    allPicks.forEach((p) => {
      if (p.gw !== gw) return;
      const o = augmentedOutcomeByPickKey.get(`${Number(gw)}:${Number(p.fixture_index)}`);
      if (o != null && o === p.pick) pts++;
    });
    return pts;
  };

  const playedGwsSorted = [...new Set<number>([...submissionGwSet, ...pickGwSet])].sort((a, b) => a - b);

  /** Avg / best / worst GW & weekly par chart — finalized gameweeks only (`finalizedStatsGwCap`). */
  const playedGwsCompletedOnlySorted =
    finalizedStatsGwCap != null ? playedGwsSorted.filter((gw) => gw <= finalizedStatsGwCap) : [];

  if (playedGwsCompletedOnlySorted.length) {
    const resolvedPts = playedGwsCompletedOnlySorted.map((gw) => ({ gw, pts: resolveUserGwPoints(gw) }));
    stats.avgPointsPerWeek = resolvedPts.reduce((s, x) => s + x.pts, 0) / resolvedPts.length;

    let bestGw = { points: -1, gw: 0 };
    let lowestGw = { points: Number.POSITIVE_INFINITY, gw: 0 };
    resolvedPts.forEach(({ gw, pts }) => {
      if (pts > bestGw.points) bestGw = { points: pts, gw };
      if (pts < lowestGw.points) lowestGw = { points: pts, gw };
    });
    if (bestGw.points >= 0) stats.bestSingleGw = bestGw;
    if (Number.isFinite(lowestGw.points)) stats.lowestSingleGw = lowestGw;
  }

  const pointsByGw = new Map<number, number>();
  playedGwsSorted.forEach((gw) => pointsByGw.set(gw, resolveUserGwPoints(gw)));

  const completedGwsBase: number[] = Array.from(
    new Set<number>((resultsRowsFullData ?? []).map((r: any) => Number(r?.gw)).filter((n: number) => Number.isFinite(n)))
  ).sort((a: number, b: number) => a - b);

  const percentileGwsSet = new Set<number>(completedGwsBase);
  if (highlightGw != null) percentileGwsSet.add(highlightGw);
  const completedGws = [...percentileGwsSet].sort((a, b) => a - b);

  const gwPercentiles = new Map<number, number>();
  completedGws.forEach((gw) => {
    const pts = byGw.get(gw) ?? [];
    if (!pts.length) return;
    const allPoints = pts.map((x) => x.points);
    const userPoints = pts.find((x) => x.user_id === userId)?.points ?? resolveUserGwPoints(gw);
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
  const weeklyPar = playedGwsCompletedOnlySorted.map((gw) => {
    const userPoints = resolveUserGwPoints(gw);
    const avg = gwAverages.get(gw);
    return {
      gw,
      userPoints,
      averagePoints: typeof avg === 'number' ? avg : userPoints,
    };
  });
  stats.weeklyParData = weeklyPar.length ? weeklyPar : null;

  const touchedGw = new Set<number>();
  submissionGwSet.forEach((g) => touchedGw.add(g));
  pickGwSet.forEach((g) => touchedGw.add(g));
  pointsByGw.forEach((_pts, g) => touchedGw.add(g));

  const rankedLastCompletedGw = typeof stats.lastCompletedGwPercentile === 'number';

  let minGw: number;
  let maxGw: number;
  if (touchedGw.size > 0) {
    minGw = Math.min(...touchedGw);
    maxGw = leftoverPriorSeason
      ? Math.max(historyLastCompletedGw ?? 0, Math.max(...touchedGw))
      : Math.max(lastCompletedGw ?? 0, metaGw ?? 0, highlightGw ?? 0, Math.max(...touchedGw));
  } else if (rankedLastCompletedGw && lastCompletedGw && lastCompletedGw > 0) {
    // User appears in last-GW points distribution but picks/submissions didn’t load — still show season ladder.
    minGw = 1;
    maxGw = Math.max(lastCompletedGw, metaGw ?? lastCompletedGw, highlightGw ?? lastCompletedGw);
  } else {
    minGw = NaN;
    maxGw = NaN;
  }

  // Full-season row: if they’ve played since GW1 and are ranked in the latest completed GW, always run through lastCompletedGw.
  if (rankedLastCompletedGw && lastCompletedGw && lastCompletedGw > 0 && minGw === 1) {
    maxGw = Math.max(maxGw, lastCompletedGw, metaGw ?? lastCompletedGw, highlightGw ?? lastCompletedGw);
  }

  /** Participation streak chips only — never extend into current/live GW (`highlightGw` / app_meta). */
  const streakCapGw = leftoverPriorSeason ? historyLastCompletedGw : lastCompletedGw;
  const streakLadderMaxGw =
    typeof streakCapGw === 'number' && streakCapGw > 0 ? Math.min(maxGw, streakCapGw) : maxGw;

  const gameweekStreakSlice: Array<{ gw: number; points: number | null; seasonLabel: string }> = [];
  if (
    Number.isFinite(minGw) &&
    Number.isFinite(maxGw) &&
    streakLadderMaxGw >= minGw &&
    minGw >= 1
  ) {
    for (let gw = minGw; gw <= streakLadderMaxGw; gw++) {
      const played = submissionGwSet.has(gw) || pickGwSet.has(gw);
      if (!played) {
        gameweekStreakSlice.push({ gw, points: null, seasonLabel: activeSeasonLabel });
        continue;
      }
      gameweekStreakSlice.push({
        gw,
        points: resolveUserGwPoints(gw),
        seasonLabel: activeSeasonLabel,
      });
    }
  }

  if (pileB) {
    const legacyStreak = await loadLegacyCareerStreak(supa, userId);
    const merged = [...legacyStreak, ...gameweekStreakSlice];
    stats.gameweekStreak = merged.length ? merged : null;
  } else {
    stats.gameweekStreak = gameweekStreakSlice.length ? gameweekStreakSlice : null;
  }

  // Trophy cabinet from already-fetched GW points (no per-GW live recompute of the whole season).
  const trophyCabinet = { gameweekPodiums: 0, monthlyPodiums: 0, seasonPodiums: 0 };

  const trophyGwUniverse = new Set<number>(completedGwsBase);
  playedGwsSorted.forEach((gw) => trophyGwUniverse.add(gw));
  if (typeof lastCompletedGw === 'number' && lastCompletedGw > 0) trophyGwUniverse.add(lastCompletedGw);
  if (typeof metaGw === 'number' && metaGw > 0) trophyGwUniverse.add(metaGw);
  const trophyGameweeks = [...trophyGwUniverse].sort((a, b) => a - b);

  trophyGameweeks.forEach((gw) => {
    const rows =
      metaGw != null && gw === metaGw && liveScoresForMetaGw.length > 0
        ? liveScoresForMetaGw
        : (byGw.get(gw) ?? []).map((x) => ({ user_id: x.user_id, score: x.points }));
    if (!rows.length) return;
    if (rankUserInGwLiveScores(userId, rows) === 1) trophyCabinet.gameweekPodiums++;
  });

  const leaderboardUniverse = new Set<string>();
  allGwPointsTyped.forEach((p) => leaderboardUniverse.add(p.user_id));

  const sumPointsRange = (uid: string, startGw: number, endGw: number) => {
    let s = 0;
    for (const p of allGwPointsTyped) {
      if (p.user_id !== uid) continue;
      if (p.gw >= startGw && p.gw <= endGw) s += p.points;
    }
    return s;
  };

  const lc = leftoverPriorSeason ? (historyLastCompletedGw ?? 0) : (lastCompletedGw ?? 0);
  const monthBuckets = pileB ? LEADERBOARD_MONTH_BUCKETS_2026_27 : LEADERBOARD_MONTH_BUCKETS;

  for (const m of monthBuckets) {
    if (lc < m.endGw) continue;
    const playedMonth = allGwPointsTyped.some(
      (p) => p.user_id === userId && p.gw >= m.startGw && p.gw <= m.endGw
    );
    if (!playedMonth) continue;
    let maxMonth = -Infinity;
    leaderboardUniverse.forEach((uid) => {
      const v = sumPointsRange(uid, m.startGw, m.endGw);
      if (v > maxMonth) maxMonth = v;
    });
    if (!Number.isFinite(maxMonth)) continue;
    if (sumPointsRange(userId, m.startGw, m.endGw) === maxMonth) trophyCabinet.monthlyPodiums++;
  }

  if (lc >= CURRENT_CAMPAIGN_END_GW) {
    const playedSeason = allGwPointsTyped.some(
      (p) => p.user_id === userId && p.gw >= 1 && p.gw <= CURRENT_CAMPAIGN_END_GW
    );
    if (playedSeason) {
      let maxSeason = -Infinity;
      leaderboardUniverse.forEach((uid) => {
        const v = sumPointsRange(uid, 1, CURRENT_CAMPAIGN_END_GW);
        if (v > maxSeason) maxSeason = v;
      });
      if (Number.isFinite(maxSeason) && sumPointsRange(userId, 1, CURRENT_CAMPAIGN_END_GW) === maxSeason) {
        trophyCabinet.seasonPodiums = 1;
      }
    }
  }

  stats.trophyCabinet = trophyCabinet;

  // Chaos index + team stats are expensive; keep parity but avoid exploding if user has no picks.
  if (allPicks.length) {
    const gws: number[] = Array.from(new Set(allPicks.map((p) => Number(p.gw)).filter((n) => Number.isFinite(n)))) as number[];

    const allUsersAppRowsPromise =
      gws.length > 0
        ? fetchAllRowsPaged<any>((from, to) =>
            applySeasonFilter(
              (supa as any)
                .from(tables.picks)
                .select('gw, fixture_index, pick')
                .in('gw', gws)
                .order('gw', { ascending: true })
                .order('fixture_index', { ascending: true })
                .range(from, to),
              seasonFilter
            )
          )
        : Promise.resolve([] as any[]);

    const allUsersLegacyRowsPromise =
      !pileB && gws.length > 0
        ? fetchAllRowsPaged<any>((from, to) =>
            (supa as any)
              .from('picks')
              .select('gw, fixture_index, pick')
              .in('gw', gws)
              .order('gw', { ascending: true })
              .order('fixture_index', { ascending: true })
              .range(from, to)
          ).catch((e: any) => {
            if (e?.code !== '42P01') throw e;
            return [] as any[];
          })
        : Promise.resolve([] as any[]);

    const fxTeamRowsPromise =
      gws.length > 0
        ? fetchAllRowsPaged<any>((from, to) =>
            applySeasonFilter(
              (supa as any)
                .from(tables.fixtures)
                .select('gw, fixture_index, home_code, away_code, home_name, away_name, home_team, away_team')
                .in('gw', gws)
                .order('gw', { ascending: true })
                .order('fixture_index', { ascending: true })
                .range(from, to),
              seasonFilter
            )
          )
        : Promise.resolve([] as any[]);

    const [allUsersAppRows, allUsersLegacyRows, fxTeamRows] = await Promise.all([
      allUsersAppRowsPromise,
      allUsersLegacyRowsPromise,
      fxTeamRowsPromise,
    ]);

    const pickCounts = new Map<string, Map<'H' | 'D' | 'A', number>>();
    const addCounts = (rows: any[]) => {
      rows.forEach((p) => {
        const key = `${Number(p.gw)}:${Number(p.fixture_index)}`;
        if (!pickCounts.has(key)) pickCounts.set(key, new Map());
        const m = pickCounts.get(key)!;
        const pick = p.pick as 'H' | 'D' | 'A';
        m.set(pick, (m.get(pick) ?? 0) + 1);
      });
    };
    addCounts(allUsersLegacyRows);
    addCounts(allUsersAppRows);

    let fieldCorrect = 0;
    let fieldTotal = 0;
    for (const p of allUsersAppRows) {
      const gw = Number(p.gw);
      if (finalizedStatsGwCap != null && Number.isFinite(gw) && gw > finalizedStatsGwCap) continue;
      const res = augmentedOutcomeByPickKey.get(`${Number(p.gw)}:${Number(p.fixture_index)}`);
      if (!res) continue;
      fieldTotal++;
      if (p.pick === res) fieldCorrect++;
    }
    if (fieldTotal > 0) {
      const fieldAveragePct = (fieldCorrect / fieldTotal) * 100;
      stats.correctPredictionFieldAvgPct = fieldAveragePct;
      const mine = stats.correctPredictionRate;
      if (typeof mine === 'number') {
        const delta = mine - fieldAveragePct;
        const band = 2;
        stats.correctPredictionVsField = delta > band ? 'above' : delta < -band ? 'below' : 'about';
      }
    }

    let chaosPicks = 0;
    let chaosCorrect = 0;
    let totalChecked = 0;
    allPicks.forEach((p) => {
      const gw = Number(p.gw);
      if (finalizedStatsGwCap != null && Number.isFinite(gw) && gw > finalizedStatsGwCap) return;
      const key = `${Number(p.gw)}:${Number(p.fixture_index)}`;
      const counts = pickCounts.get(key);
      if (!counts) return;
      const totalPickers = Array.from(counts.values()).reduce((s, n) => s + n, 0);
      if (!totalPickers) return;
      const userPickCount = counts.get(p.pick) ?? 0;
      const pct = (userPickCount / totalPickers) * 100;
      totalChecked++;
      if (pct <= 25) {
        chaosPicks++;
        const res = augmentedOutcomeByPickKey.get(key);
        if (res && res === p.pick) chaosCorrect++;
      }
    });
    if (totalChecked > 0) {
      stats.chaosIndex = (chaosPicks / totalChecked) * 100;
      stats.chaosCorrectCount = chaosCorrect;
      stats.chaosTotalCount = chaosPicks;
    }

    // Team stats: same keys as correct-call rate — for each *pick* with a result, join `app_fixtures` (always fetch; don't rely on `fxPickRows` subset).
    const fxByKeyTeam = new Map<string, any>();
    fxTeamRows.forEach((f: any) => {
      if (!fixtureRowIsPremierLeague(f)) return;
      fxByKeyTeam.set(`${Number(f.gw)}:${Number(f.fixture_index)}`, f);
    });

    const teamStats = new Map<string, { correct: number; total: number; code: string | null; name: string }>();

    /** Each fixture credits **both** clubs the same way: right pick → both correct++ ; wrong → neither gets correct++. */
    const bumpBothTeams = (fixture: any, gotItRight: boolean) => {
      /** Never aggregate `__NAME__:*` keys — corrupted rows can show Paris with bogus TLAs. */
      const bumpOne = (codeRaw: string | null | undefined, displayFallback: string) => {
        const canon = canonicalPremierTeamCode(codeRaw);
        if (!canon || !PREMIER_LEAGUE_TEAM_CODES.has(canon)) return;
        const label = PREMIER_CODE_DISPLAY_NAME[canon] ?? (displayFallback.trim() || canon);
        const existing = teamStats.get(canon) ?? { correct: 0, total: 0, code: canon, name: label };
        existing.total++;
        if (gotItRight) existing.correct++;
        existing.name = PREMIER_CODE_DISPLAY_NAME[canon] ?? existing.name;
        teamStats.set(canon, existing);
      };

      const homeCode =
        typeof fixture.home_code === 'string' && fixture.home_code.trim() ? fixture.home_code.trim() : null;
      const awayCode =
        typeof fixture.away_code === 'string' && fixture.away_code.trim() ? fixture.away_code.trim() : null;
      const homeFb =
        String(fixture.home_name || fixture.home_team || 'Home').trim() || 'Home';
      const awayFb =
        String(fixture.away_name || fixture.away_team || 'Away').trim() || 'Away';

      bumpOne(homeCode, homeFb);
      bumpOne(awayCode, awayFb);
    };

    for (const p of allPicks) {
      const gw = Number(p.gw);
      if (finalizedStatsGwCap != null && Number.isFinite(gw) && gw > finalizedStatsGwCap) continue;
      const key = `${Number(p.gw)}:${Number(p.fixture_index)}`;
      const result = augmentedOutcomeByPickKey.get(key);
      if (!result) continue;
      const fx = fxByKeyTeam.get(key);
      if (!fx) continue;
      bumpBothTeams(fx, p.pick === result);
    }

    let mostCorrect: { code: string | null; name: string; percentage: number } | null = null;
    let mostIncorrect: { code: string | null; name: string; percentage: number } | null = null;
    let mostCorrectWeight = -1;
    let mostIncorrectWeight = -1;
    teamStats.forEach((s) => {
      if (s.total < 1) return;
      const correctPct = (s.correct / s.total) * 100;
      const incorrectPct = ((s.total - s.correct) / s.total) * 100;
      if (!Number.isFinite(correctPct) || !Number.isFinite(incorrectPct)) return;
      const beatsCorrect =
        !mostCorrect ||
        correctPct > mostCorrect.percentage ||
        (correctPct === mostCorrect.percentage && s.total > mostCorrectWeight);
      if (beatsCorrect) {
        mostCorrect = { code: s.code, name: s.name, percentage: correctPct };
        mostCorrectWeight = s.total;
      }
      const beatsIncorrect =
        !mostIncorrect ||
        incorrectPct > mostIncorrect.percentage ||
        (incorrectPct === mostIncorrect.percentage && s.total > mostIncorrectWeight);
      if (beatsIncorrect) {
        mostIncorrect = { code: s.code, name: s.name, percentage: incorrectPct };
        mostIncorrectWeight = s.total;
      }
    });
    stats.mostCorrectTeam = mostCorrect;
    stats.mostIncorrectTeam = mostIncorrect;
  }

  return stats;
}

async function loadLegacyCareerStreak(
  supa: any,
  userId: string
): Promise<Array<{ gw: number; points: number | null; seasonLabel: string }>> {
  const [points, submissionsRes] = await Promise.all([
    fetchAllRowsPaged<{ gw: number; points: number }>((from, to) =>
      (supa as any)
        .from('app_v_gw_points')
        .select('gw, points')
        .eq('user_id', userId)
        .order('gw', { ascending: true })
        .range(from, to)
    ),
    (supa as any).from('app_gw_submissions').select('gw').eq('user_id', userId),
  ]);
  if (submissionsRes.error) throw submissionsRes.error;

  const byGw = new Map<number, number>();
  for (const p of points) {
    const gw = Number(p.gw);
    if (Number.isFinite(gw)) byGw.set(gw, Number(p.points ?? 0));
  }
  const played = new Set<number>(byGw.keys());
  for (const row of submissionsRes.data ?? []) {
    const gw = Number(row.gw);
    if (Number.isFinite(gw)) played.add(gw);
  }
  if (!played.size) return [];

  const minGw = Math.min(...played);
  const maxGw = Math.min(CURRENT_CAMPAIGN_END_GW, Math.max(...played));
  const rows: Array<{ gw: number; points: number | null; seasonLabel: string }> = [];
  for (let gw = minGw; gw <= maxGw; gw++) {
    if (!played.has(gw)) {
      rows.push({ gw, points: null, seasonLabel: SEASON_2025_26_LABEL });
      continue;
    }
    rows.push({
      gw,
      points: byGw.has(gw) ? byGw.get(gw)! : 0,
      seasonLabel: SEASON_2025_26_LABEL,
    });
  }
  return rows;
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
    (supa as any).from('league_members').select('league_id, user_id, created_at').in('league_id', leagueIds),
    (supa as any).from('app_gw_results').select('gw, fixture_index, result').order('gw', { ascending: false }),
    (supa as any).from('app_meta').select('current_gw').eq('id', 1).maybeSingle(),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (resultsRes.error) throw resultsRes.error;
  if (metaRes.error) throw metaRes.error;
  const currentGw = Number(metaRes.data?.current_gw ?? 1);

  const membersByLeague = new Map<string, string[]>();
  const memberJoinedAtByLeague = new Map<string, string[]>();
  (membersRes.data ?? []).forEach((lm: any) => {
    const leagueId = String(lm.league_id);
    const arr = membersByLeague.get(leagueId) ?? [];
    arr.push(String(lm.user_id));
    membersByLeague.set(leagueId, arr);

    if (typeof lm.created_at === 'string') {
      const joined = memberJoinedAtByLeague.get(leagueId) ?? [];
      joined.push(lm.created_at);
      memberJoinedAtByLeague.set(leagueId, joined);
    }
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

    const joinedAt = (memberJoinedAtByLeague.get(league.id) ?? []).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const leagueStartGw = await resolveLeagueStartGw(supa, { ...league, activation_at: joinedAt[1] ?? null }, currentGw);
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

