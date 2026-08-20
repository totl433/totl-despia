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

function getLeagueStartOverride(
  name?: string | null,
  opts?: { seasonId?: string | null }
): number | undefined {
  if (!name) return undefined;
  // API Test is a sandbox, not a real season window.
  if (name === 'API Test') return LEAGUE_START_OVERRIDES[name];
  // 2026/27+: last season's "started at GW7/GW8" names must not carry over.
  if (opts?.seasonId) return undefined;
  return LEAGUE_START_OVERRIDES[name];
}

export async function resolveLeagueStartGw(
  supa: any,
  league: LeagueRecord | null | undefined,
  currentGw: number,
  options?: { fixturesTable?: string; seasonId?: string | null }
): Promise<number> {
  if (!league?.id) return currentGw;
  const fixturesTable = options?.fixturesTable ?? 'app_fixtures';
  const seasonId = options?.seasonId ?? null;
  const override = getLeagueStartOverride(league.name ?? null, { seasonId });
  if (typeof override === 'number') return override;

  const startTimestamp = league.activation_at ?? league.created_at;
  if (startTimestamp && currentGw) {
    const leagueActivatedAt = new Date(startTimestamp);
    if (Number.isNaN(leagueActivatedAt.getTime())) return currentGw;

    let fxQ = (supa as any)
      .from(fixturesTable)
      .select('gw,kickoff_time')
      .not('kickoff_time', 'is', null)
      .order('gw', { ascending: true })
      .order('kickoff_time', { ascending: true });
    if (seasonId) fxQ = fxQ.eq('season_id', seasonId);
    const { data: fixturesData } = await fxQ;

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
