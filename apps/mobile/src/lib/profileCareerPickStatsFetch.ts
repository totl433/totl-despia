import {
  computeCareerOverallPercentile,
  computeCareerPickStats,
  computeCareerWeeklyPar,
  tagCareerPile,
  type CareerPickStats,
  type CareerWeeklyParRow,
} from './profileCareerPickStats';
import { computePersonalGwPodiumWins } from './gwPodiumsFromGwPoints';
import { fetchAllSupabaseRows } from './profileStreakRows';
import { supabase } from './supabase';

export type CareerStatsBundle = CareerPickStats & {
  weeklyPar: CareerWeeklyParRow[];
  overallPercentile: number | null;
  seasonGwWins: number;
};

export async function fetchCareerPickStats(args: {
  userId: string;
  seasonId: string;
}): Promise<CareerStatsBundle> {
  const [
    legacyPicks,
    seasonPicks,
    legacyResults,
    seasonResults,
    legacyFx,
    seasonFx,
    fieldLegacyPicks,
    fieldSeasonPicks,
    legacyGwPoints,
    seasonGwPoints,
    legacyOcp,
    seasonOcp,
  ] = await Promise.all([
    fetchAllSupabaseRows<{ gw: number; fixture_index: number; pick: string | null }>((from, to) =>
      supabase
        .from('app_picks')
        .select('gw, fixture_index, pick')
        .eq('user_id', args.userId)
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{ gw: number; fixture_index: number; pick: string | null }>((from, to) =>
      (supabase as any)
        .from('app_season_picks')
        .select('gw, fixture_index, pick')
        .eq('user_id', args.userId)
        .eq('season_id', args.seasonId)
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{ gw: number; fixture_index: number; result: string | null }>((from, to) =>
      supabase
        .from('app_gw_results')
        .select('gw, fixture_index, result')
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{ gw: number; fixture_index: number; result: string | null }>((from, to) =>
      (supabase as any)
        .from('app_season_results')
        .select('gw, fixture_index, result')
        .eq('season_id', args.seasonId)
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{
      gw: number;
      fixture_index: number;
      home_code?: string | null;
      away_code?: string | null;
      home_name?: string | null;
      away_name?: string | null;
    }>((from, to) =>
      supabase
        .from('app_fixtures')
        .select('gw, fixture_index, home_code, away_code, home_name, away_name')
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{
      gw: number;
      fixture_index: number;
      home_code?: string | null;
      away_code?: string | null;
      home_name?: string | null;
      away_name?: string | null;
    }>((from, to) =>
      (supabase as any)
        .from('app_season_fixtures')
        .select('gw, fixture_index, home_code, away_code')
        .eq('season_id', args.seasonId)
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{ gw: number; fixture_index: number; pick: string | null }>((from, to) =>
      supabase
        .from('app_picks')
        .select('gw, fixture_index, pick')
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .range(from, to)
    ).then(async (appRows) => {
      try {
        const legacy = await fetchAllSupabaseRows<{ gw: number; fixture_index: number; pick: string | null }>(
          (from, to) =>
            supabase
              .from('picks')
              .select('gw, fixture_index, pick')
              .order('gw', { ascending: true })
              .order('fixture_index', { ascending: true })
              .range(from, to)
        );
        return [...legacy, ...appRows];
      } catch {
        return appRows;
      }
    }),
    fetchAllSupabaseRows<{ gw: number; fixture_index: number; pick: string | null }>((from, to) =>
      (supabase as any)
        .from('app_season_picks')
        .select('gw, fixture_index, pick')
        .eq('season_id', args.seasonId)
        .order('gw', { ascending: true })
        .order('fixture_index', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{ user_id: string; gw: number; points: number }>((from, to) =>
      supabase
        .from('app_v_gw_points')
        .select('user_id, gw, points')
        .order('gw', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{ user_id: string; gw: number; points: number }>((from, to) =>
      (supabase as any)
        .from('app_v_season_gw_points')
        .select('user_id, gw, points')
        .eq('season_id', args.seasonId)
        .order('gw', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to)
    ),
    fetchAllSupabaseRows<{ user_id: string; ocp: number }>((from, to) =>
      supabase.from('app_v_ocp_overall').select('user_id, ocp').order('user_id', { ascending: true }).range(from, to)
    ),
    fetchAllSupabaseRows<{ user_id: string; ocp: number }>((from, to) =>
      (supabase as any)
        .from('app_v_season_ocp_overall')
        .select('user_id, ocp')
        .eq('season_id', args.seasonId)
        .order('user_id', { ascending: true })
        .range(from, to)
    ),
  ]);

  const picks = [...tagCareerPile('legacy', legacyPicks), ...tagCareerPile('season', seasonPicks)];
  const computed = computeCareerPickStats({
    picks,
    results: [...tagCareerPile('legacy', legacyResults), ...tagCareerPile('season', seasonResults)],
    fixtures: [...tagCareerPile('legacy', legacyFx), ...tagCareerPile('season', seasonFx)],
    fieldPicks: [...tagCareerPile('legacy', fieldLegacyPicks), ...tagCareerPile('season', fieldSeasonPicks)],
    pileLabels: { legacy: '2025/26', season: '2026/27' },
  });
  return {
    ...computed,
    weeklyPar: computeCareerWeeklyPar({
      userId: args.userId,
      legacyPoints: legacyGwPoints,
      seasonPoints: seasonGwPoints,
      legacyLabel: '2025/26',
      seasonLabel: '2026/27',
    }),
    overallPercentile: computeCareerOverallPercentile({
      userId: args.userId,
      legacy: legacyOcp,
      season: seasonOcp,
    }),
    seasonGwWins: computePersonalGwPodiumWins({
      gwPointsRows: seasonGwPoints,
      userId: args.userId,
    }).wins,
  };
}
