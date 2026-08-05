import { supabase } from './supabase';
import { normalizeTeamCode } from './teamColors';

function normalizePositionMap(raw: Record<string, unknown> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};

  Object.entries(raw ?? {}).forEach(([codeRaw, posRaw]) => {
    const code = normalizeTeamCode(codeRaw) ?? String(codeRaw ?? '').trim().toUpperCase();
    const pos = Number(posRaw);
    if (!code) return;
    if (!Number.isFinite(pos) || pos <= 0) return;
    out[code] = Math.trunc(pos);
  });

  return out;
}

/**
 * Client fallback when `/v1/predictions` already returns enough ranks.
 * Prefer the seed (BFF owns season-stack rules). Only fill gaps for legacy
 * incomplete snapshots — never overwrite season-derived ranks.
 */
export function normalizeTeamPositions(raw: Record<string, unknown> | null | undefined): Record<string, number> {
  return normalizePositionMap(raw);
}

export async function fetchTeamPositionsWithFallback(seedRaw?: Record<string, unknown> | null): Promise<Record<string, number>> {
  const seededPositions = normalizePositionMap(seedRaw);
  // BFF already resolved season-stack ranks (including pre-season last-table fallback).
  if (Object.keys(seededPositions).length >= 10) return seededPositions;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Prefer season runtime for testers; app_meta is still legacy pile-A for store builds.
    let useSeasonStack = false;
    if (user?.id) {
      const { data: prefs } = await supabase
        .from('user_notification_preferences')
        .select('use_season_stack')
        .eq('user_id', user.id)
        .maybeSingle();
      useSeasonStack = !!(prefs as { use_season_stack?: boolean } | null)?.use_season_stack;
    }

    const [{ data: runtime }, { data: meta }] = await Promise.all([
      supabase.from('app_season_runtime').select('current_gw').eq('id', 1).maybeSingle(),
      supabase.from('app_meta').select('current_gw').eq('id', 1).maybeSingle(),
    ]);

    const runtimeGw = Number((runtime as { current_gw?: unknown } | null)?.current_gw);
    const metaGw = Number((meta as { current_gw?: unknown } | null)?.current_gw);
    const gwToTry =
      useSeasonStack && Number.isFinite(runtimeGw) && runtimeGw > 0
        ? Math.trunc(runtimeGw)
        : Number.isFinite(metaGw) && metaGw > 0
          ? Math.trunc(metaGw)
          : null;

    if (gwToTry) {
      const { data } = await supabase.from('app_team_forms').select('team_code, league_position').eq('gw', gwToTry);
      const currentGwPositions: Record<string, number> = {};
      (data ?? []).forEach((row: { team_code?: string; league_position?: number }) => {
        const code = normalizeTeamCode(row?.team_code) ?? String(row?.team_code ?? '').trim().toUpperCase();
        const pos = Number(row?.league_position);
        if (!code) return;
        if (!Number.isFinite(pos) || pos <= 0) return;
        currentGwPositions[code] = Math.trunc(pos);
      });
      if (Object.keys(currentGwPositions).length > 0) {
        return { ...currentGwPositions, ...seededPositions };
      }
    }

    // Season-stack pre-season with empty seed already handled by BFF.
    // Legacy: last GW that has league positions.
    if (useSeasonStack) return seededPositions;

    const { data: latestWithPosition } = await supabase
      .from('app_team_forms')
      .select('gw')
      .not('league_position', 'is', null)
      .order('gw', { ascending: false })
      .limit(1);

    const fallbackGw = Number(latestWithPosition?.[0]?.gw);
    if (Number.isFinite(fallbackGw) && fallbackGw > 0) {
      const { data } = await supabase
        .from('app_team_forms')
        .select('team_code, league_position')
        .eq('gw', Math.trunc(fallbackGw));
      const fallbackPositions: Record<string, number> = {};
      (data ?? []).forEach((row: { team_code?: string; league_position?: number }) => {
        const code = normalizeTeamCode(row?.team_code) ?? String(row?.team_code ?? '').trim().toUpperCase();
        const pos = Number(row?.league_position);
        if (!code) return;
        if (!Number.isFinite(pos) || pos <= 0) return;
        fallbackPositions[code] = Math.trunc(pos);
      });
      return { ...fallbackPositions, ...seededPositions };
    }
  } catch {
    return seededPositions;
  }

  return seededPositions;
}
