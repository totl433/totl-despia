type LeagueRecord = { id: string; name?: string | null; created_at?: string | null; activation_at?: string | null };

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

  const startTimestamp = league.activation_at ?? league.created_at;
  if (startTimestamp && currentGw) {
    const leagueActivatedAt = new Date(startTimestamp);
    if (Number.isNaN(leagueActivatedAt.getTime())) return currentGw;

    const { data: fixturesData } = await (supa as any)
      .from('app_fixtures')
      .select('gw,kickoff_time')
      .not('kickoff_time', 'is', null)
      .order('gw', { ascending: true })
      .order('kickoff_time', { ascending: true });

    const firstKickoffByGw = new Map<number, string>();
    (fixturesData ?? []).forEach((fixture: any) => {
      const gw = Number(fixture?.gw);
      if (!Number.isFinite(gw) || firstKickoffByGw.has(gw)) return;
      if (typeof fixture?.kickoff_time === 'string') firstKickoffByGw.set(gw, fixture.kickoff_time);
    });

    const gwDeadlines = Array.from(firstKickoffByGw.entries())
      .map(([gw, kickoff]) => ({ gw, deadlineTime: new Date(new Date(kickoff).getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000) }))
      .filter((row) => !Number.isNaN(row.deadlineTime.getTime()))
      .sort((a, b) => a.deadlineTime.getTime() - b.deadlineTime.getTime());

    for (const row of gwDeadlines) {
      if (leagueActivatedAt < row.deadlineTime) return row.gw;
    }

    if (gwDeadlines.length > 0) return Math.max(...gwDeadlines.map((row) => row.gw)) + 1;
    return currentGw;
  }

  return currentGw;
}

