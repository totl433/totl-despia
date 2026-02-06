type LeagueRecord = { id: string; name?: string | null; created_at?: string | null };

const DEADLINE_BUFFER_MINUTES = 75;

export const LEAGUE_START_OVERRIDES: Record<string, number> = {
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

export async function resolveLeagueStartGw(
  supa: any,
  league: LeagueRecord | null | undefined,
  currentGw: number
): Promise<number> {
  if (!league?.id) return currentGw;
  const override = getLeagueStartOverride(league.name ?? null);
  if (typeof override === 'number') return override;

  if (league.created_at && currentGw) {
    const leagueCreatedAt = new Date(league.created_at);

    // Use app tables (native single source of truth).
    const { data: resultsData } = await (supa as any).from('app_gw_results').select('gw').order('gw', { ascending: true });
    const completedGws: number[] = resultsData
      ? Array.from(new Set((resultsData as any[]).map((r) => Number((r as any)?.gw)).filter((n) => Number.isFinite(n))))
      : [];

    for (const gw of completedGws) {
      const { data: firstFixture } = await (supa as any)
        .from('app_fixtures')
        .select('kickoff_time')
        .eq('gw', gw)
        .order('kickoff_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstFixture?.kickoff_time) {
        const firstKickoff = new Date(firstFixture.kickoff_time);
        const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
        if (leagueCreatedAt < deadlineTime) return gw;
      }
    }

    if (completedGws.length > 0) return Math.max(...completedGws) + 1;
    return currentGw;
  }

  return currentGw;
}

