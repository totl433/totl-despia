import { mergeProfileCareerTotals } from './profileSummaryCareerLogic';
import { supabase } from './supabase';

export { mergeProfileCareerTotals } from './profileSummaryCareerLogic';

const PRIOR_SEASON_END_GW = 38;
const LIVE_SEASON_FALLBACK_ID = 'e0a58f84-9575-4b6b-adca-320defc04b46';

function playedSet(rows: Array<{ gw?: unknown } | null | undefined> | null | undefined): Set<number> {
  const out = new Set<number>();
  for (const row of rows ?? []) {
    const gw = Number(row?.gw);
    if (Number.isFinite(gw) && gw >= 1) out.add(gw);
  }
  return out;
}

/** Profile card OCP + streak across last season and this season. */
export async function fetchProfileCareerTotals(userId: string): Promise<{ ocp: number; weeksStreak: number }> {
  const runtime = await (supabase as any)
    .from('app_season_runtime')
    .select('current_season_id')
    .eq('id', 1)
    .maybeSingle();
  const seasonId =
    (runtime.data?.current_season_id as string | null) || LIVE_SEASON_FALLBACK_ID;

  const [priorOcpRes, priorPointsRes, priorSubsRes, priorLastRes, seasonOcpRes, seasonPointsRes, seasonSubsRes, seasonLastRes] =
    await Promise.all([
      supabase.from('app_v_ocp_overall').select('ocp').eq('user_id', userId).maybeSingle(),
      supabase.from('app_v_gw_points').select('gw').eq('user_id', userId),
      supabase.from('app_gw_submissions').select('gw').eq('user_id', userId),
      supabase.from('app_gw_results').select('gw').order('gw', { ascending: false }).limit(1).maybeSingle(),
      (supabase as any)
        .from('app_v_season_ocp_overall')
        .select('ocp')
        .eq('user_id', userId)
        .eq('season_id', seasonId)
        .maybeSingle(),
      (supabase as any).from('app_v_season_gw_points').select('gw').eq('user_id', userId).eq('season_id', seasonId),
      (supabase as any).from('app_season_submissions').select('gw').eq('user_id', userId).eq('season_id', seasonId),
      (supabase as any)
        .from('app_season_results')
        .select('gw')
        .eq('season_id', seasonId)
        .order('gw', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (priorOcpRes.error) throw priorOcpRes.error;
  if (priorPointsRes.error) throw priorPointsRes.error;
  if (priorSubsRes.error) throw priorSubsRes.error;
  if (priorLastRes.error) throw priorLastRes.error;
  if (seasonOcpRes.error) throw seasonOcpRes.error;
  if (seasonPointsRes.error) throw seasonPointsRes.error;
  if (seasonSubsRes.error) throw seasonSubsRes.error;
  if (seasonLastRes.error) throw seasonLastRes.error;

  const priorPlayed = playedSet([...(priorPointsRes.data ?? []), ...(priorSubsRes.data ?? [])]);
  let priorThrough = Number(priorLastRes.data?.gw ?? 0);
  if (!Number.isFinite(priorThrough) || priorThrough < 1) {
    priorThrough = priorPlayed.size ? Math.max(...priorPlayed) : 0;
  }
  if (priorThrough > PRIOR_SEASON_END_GW) priorThrough = PRIOR_SEASON_END_GW;

  const seasonPlayed = playedSet([...(seasonPointsRes.data ?? []), ...(seasonSubsRes.data ?? [])]);
  const seasonThrough = Number(seasonLastRes.data?.gw ?? 0);

  return mergeProfileCareerTotals({
    priorOcp: Number(priorOcpRes.data?.ocp ?? 0),
    seasonOcp: Number(seasonOcpRes.data?.ocp ?? 0),
    priorPlayed,
    priorThroughGw: priorThrough,
    seasonPlayed,
    seasonThroughGw: Number.isFinite(seasonThrough) && seasonThrough > 0 ? seasonThrough : 0,
  });
}
