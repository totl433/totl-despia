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

async function readPositionsForGw(gw: number): Promise<Record<string, number>> {
  const { data } = await supabase.from('app_team_forms').select('team_code, league_position').eq('gw', gw);
  const out: Record<string, number> = {};

  (data ?? []).forEach((row: { team_code?: string; league_position?: number }) => {
    const code = normalizeTeamCode(row?.team_code) ?? String(row?.team_code ?? '').trim().toUpperCase();
    const pos = Number(row?.league_position);
    if (!code) return;
    if (!Number.isFinite(pos) || pos <= 0) return;
    out[code] = Math.trunc(pos);
  });

  return out;
}

export function normalizeTeamPositions(raw: Record<string, unknown> | null | undefined): Record<string, number> {
  return normalizePositionMap(raw);
}

export async function fetchTeamPositionsWithFallback(seedRaw?: Record<string, unknown> | null): Promise<Record<string, number>> {
  const seededPositions = normalizePositionMap(seedRaw);
  if (Object.keys(seededPositions).length >= 20) return seededPositions;

  try {
    const { data: meta } = await supabase.from('app_meta').select('current_gw').eq('id', 1).maybeSingle();
    const currentGw = Number((meta as { current_gw?: unknown })?.current_gw);
    const gwToTry = Number.isFinite(currentGw) && currentGw > 0 ? Math.trunc(currentGw) : null;

    if (gwToTry) {
      const currentGwPositions = await readPositionsForGw(gwToTry);
      if (Object.keys(currentGwPositions).length > 0) {
        return { ...currentGwPositions, ...seededPositions };
      }
    }

    const { data: latestWithPosition } = await supabase
      .from('app_team_forms')
      .select('gw')
      .not('league_position', 'is', null)
      .order('gw', { ascending: false })
      .limit(1);

    const fallbackGw = Number(latestWithPosition?.[0]?.gw);
    if (Number.isFinite(fallbackGw) && fallbackGw > 0) {
      const fallbackPositions = await readPositionsForGw(Math.trunc(fallbackGw));
      return { ...fallbackPositions, ...seededPositions };
    }
  } catch {
    return seededPositions;
  }

  return seededPositions;
}
