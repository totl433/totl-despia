import { supabase } from './supabase';

type LeagueRecord = {
  id: string;
  name?: string | null;
  created_at?: string | null;
  start_gw?: number | null;
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

async function ensureLeagueMeta(league: LeagueRecord): Promise<LeagueRecord> {
  const needsName = typeof league.name !== 'string';
  const needsCreatedAt = typeof league.created_at !== 'string';
  if (!needsName && !needsCreatedAt) return league;

  const { data, error } = await (supabase as any)
    .from('leagues')
    .select('name, created_at')
    .eq('id', league.id)
    .maybeSingle();
  if (error || !data) return league;

  return {
    ...league,
    name: needsName ? data.name : league.name,
    created_at: needsCreatedAt ? data.created_at : league.created_at,
  };
}

type GwDeadlineRow = { gw: number; deadlineTime: Date };
let gwDeadlineRowsPromise: Promise<GwDeadlineRow[]> | null = null;

async function getGwDeadlineRows(): Promise<GwDeadlineRow[]> {
  if (!gwDeadlineRowsPromise) {
    gwDeadlineRowsPromise = (async () => {
      // Web currently derives league start from legacy tables (`gw_results` + `fixtures`).
      // Keep Expo aligned with production web calculations.
      const { data: resultsData, error: resultsErr } = await (supabase as any)
        .from('gw_results')
        .select('gw')
        .order('gw', { ascending: true });
      if (resultsErr) return [];

      const completedGws: number[] = resultsData
        ? Array.from(new Set((resultsData as any[]).map((r) => Number(r.gw)).filter((n) => Number.isFinite(n))))
        : [];

      const rows: GwDeadlineRow[] = [];
      for (const gw of completedGws) {
        const { data: firstFixture, error: fixErr } = await (supabase as any)
          .from('fixtures')
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
        rows.push({
          gw,
          deadlineTime: new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000),
        });
      }
      return rows;
    })();
  }

  return gwDeadlineRowsPromise;
}

async function resolveStartGwFromCreatedAt(createdAt: string | null | undefined, currentGw: number): Promise<number> {
  if (!isIsoDate(createdAt) || !currentGw) return currentGw;
  const leagueCreatedAt = new Date(createdAt);
  if (Number.isNaN(leagueCreatedAt.getTime())) return currentGw;

  const gwDeadlineRows = await getGwDeadlineRows();
  for (const row of gwDeadlineRows) {
    if (leagueCreatedAt < row.deadlineTime) return row.gw;
  }

  if (gwDeadlineRows.length > 0) return Math.max(...gwDeadlineRows.map((row) => row.gw)) + 1;
  return currentGw;
}

/**
 * resolveLeagueStartGw (mobile)
 * Computes the first GW this league should participate in.
 * Keep this aligned with web resolver behavior for consistent standings/join locks.
 */
export async function resolveLeagueStartGw(league: LeagueRecord | null | undefined, currentGw: number): Promise<number> {
  if (!league?.id) return currentGw;

  const withMeta = await ensureLeagueMeta(league);
  const override = getLeagueStartOverride(withMeta.name ?? null);
  if (typeof override === 'number') return override;

  if (withMeta.start_gw !== null && withMeta.start_gw !== undefined) return withMeta.start_gw;

  return resolveStartGwFromCreatedAt(withMeta.created_at, currentGw);
}

export async function resolveMemberStartGw(memberCreatedAt: string | null | undefined, fallbackStartGw: number, currentGw: number): Promise<number> {
  if (!isIsoDate(memberCreatedAt)) return fallbackStartGw;
  const resolved = await resolveStartGwFromCreatedAt(memberCreatedAt, currentGw);
  return Math.max(fallbackStartGw, resolved);
}

