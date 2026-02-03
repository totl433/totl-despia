import { supabase } from './supabase';

type LeagueRecord = {
  id: string;
  name?: string | null;
  created_at?: string | null;
};

const DEADLINE_BUFFER_MINUTES = 75;

// Mirror web overrides (src/lib/leagueStart.ts).
const LEAGUE_START_OVERRIDES: Record<string, number> = {
  'Prem Predictions': 0,
  'FC Football': 0,
  'Easy League': 0,
  'API Test': 999,
  'The Bird league': 7,
  gregVjofVcarl: 8,
  'Let Down': 8,
};

function getLeagueStartOverride(name?: string | null): number | undefined {
  if (!name) return undefined;
  return LEAGUE_START_OVERRIDES[name];
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 10;
}

/**
 * resolveLeagueStartGw (mobile)
 * Computes the first GW this league should participate in, mirroring web logic but using app tables.
 */
export async function resolveLeagueStartGw(league: LeagueRecord | null | undefined, currentGw: number): Promise<number> {
  if (!league?.id) return currentGw;

  const override = getLeagueStartOverride(league.name ?? null);
  if (typeof override === 'number') return override;

  if (!isIsoDate(league.created_at) || !currentGw) return currentGw;
  const leagueCreatedAt = new Date(league.created_at);
  if (Number.isNaN(leagueCreatedAt.getTime())) return currentGw;

  const { data: resultsData, error: resultsErr } = await (supabase as any)
    .from('app_gw_results')
    .select('gw')
    .order('gw', { ascending: true });
  if (resultsErr) return currentGw;

  const completedGws: number[] = resultsData ? Array.from(new Set((resultsData as any[]).map((r) => Number(r.gw)).filter((n) => Number.isFinite(n)))) : [];

  for (const gw of completedGws) {
    const { data: firstFixture, error: fixErr } = await (supabase as any)
      .from('app_fixtures')
      .select('kickoff_time')
      .eq('gw', gw)
      .order('kickoff_time', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fixErr) continue;
    const kickoff = firstFixture?.kickoff_time;
    if (!kickoff) continue;
    const firstKickoff = new Date(kickoff);
    if (Number.isNaN(firstKickoff.getTime())) continue;
    const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
    if (leagueCreatedAt < deadlineTime) return gw;
  }

  if (completedGws.length > 0) return Math.max(...completedGws) + 1;
  return currentGw;
}

