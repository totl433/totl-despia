import { supabase } from './supabase';

type LeagueRecord = {
  id: string;
  name?: string | null;
  created_at?: string | null;
  activation_at?: string | null;
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

type LeagueMemberRecord = {
  created_at?: string | null;
};

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
      const { data, error } = await (supabase as any)
        .from('app_fixtures')
        .select('gw,kickoff_time')
        .not('kickoff_time', 'is', null)
        .order('gw', { ascending: true })
        .order('kickoff_time', { ascending: true });
      if (error) return [];

      const firstKickoffByGw = new Map<number, string>();
      (data ?? []).forEach((fixture: { gw?: number | null; kickoff_time?: string | null }) => {
        const gw = Number(fixture.gw);
        if (!Number.isFinite(gw) || firstKickoffByGw.has(gw)) return;
        if (fixture.kickoff_time) firstKickoffByGw.set(gw, fixture.kickoff_time);
      });

      const rows: GwDeadlineRow[] = [];
      firstKickoffByGw.forEach((kickoff, gw) => {
        if (!kickoff) return;
        const firstKickoff = new Date(kickoff);
        if (Number.isNaN(firstKickoff.getTime())) return;
        rows.push({
          gw,
          deadlineTime: new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000),
        });
      });
      return rows;
    })();
  }

  return gwDeadlineRowsPromise;
}

async function resolveStartGwFromTimestamp(timestamp: string | null | undefined, currentGw: number): Promise<number> {
  if (!isIsoDate(timestamp) || !currentGw) return currentGw;
  const activatedAt = new Date(timestamp);
  if (Number.isNaN(activatedAt.getTime())) return currentGw;

  const gwDeadlineRows = await getGwDeadlineRows();
  for (const row of gwDeadlineRows) {
    if (activatedAt < row.deadlineTime) return row.gw;
  }

  if (gwDeadlineRows.length > 0) return Math.max(...gwDeadlineRows.map((row) => row.gw)) + 1;
  return currentGw;
}

export function getLeagueActivationAt(members: LeagueMemberRecord[] | null | undefined): string | null {
  const joinedAt = (members ?? [])
    .map((member) => member.created_at)
    .filter(isIsoDate)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return joinedAt[1] ?? null;
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

  if (withMeta.activation_at) return resolveStartGwFromTimestamp(withMeta.activation_at, currentGw);

  return resolveStartGwFromTimestamp(withMeta.created_at, currentGw);
}

export async function resolveMemberStartGw(memberCreatedAt: string | null | undefined, fallbackStartGw: number, currentGw: number): Promise<number> {
  if (!isIsoDate(memberCreatedAt)) return fallbackStartGw;
  const resolved = await resolveStartGwFromTimestamp(memberCreatedAt, currentGw);
  return Math.max(fallbackStartGw, resolved);
}

