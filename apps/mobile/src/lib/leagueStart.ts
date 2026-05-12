import { orderCompletedGwsByFirstKickoff } from '@totl/domain';
import { supabase } from './supabase';

type LeagueRecord = {
  id: string;
  name?: string | null;
  created_at?: string | null;
  activation_at?: string | null;
  /** Only used if present on the league object (playtotl `useLeagueMeta` does not load this from DB). */
  start_gw?: unknown;
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

/** Coerce `leagues.start_gw` from API/PostgREST (number or numeric string). */
export function parseOptionalGw(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isParseableInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value.trim()));
}

/** Same filter as web `src/lib/leagueStart.ts` (excludes date-only strings length 10). */
function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 10;
}

/**
 * Second member join time for competitive clock — must match web `getLeagueActivationAt`
 * (`src/lib/leagueStart.ts`) so mini-league season windows match playtotl.
 */
export function getLeagueActivationAt(members: Array<{ created_at?: string | null }> | null | undefined): string | null {
  const joinedAt = (members ?? [])
    .map((m) => m.created_at)
    .filter(isIsoDate)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return joinedAt[1] ?? null;
}

/** Mirror web `ensureLeagueMeta`: only name + created_at (no `start_gw` column fetch). */
async function ensureLeagueMeta(league: LeagueRecord): Promise<LeagueRecord> {
  const needsName = typeof league.name !== 'string';
  const needsCreatedAt = typeof league.created_at !== 'string';

  if (!needsName && !needsCreatedAt) {
    return league;
  }

  const { data, error } = await (supabase as any).from('leagues').select('name, created_at').eq('id', league.id).maybeSingle();

  if (error || !data) {
    return league;
  }

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
      return rows.sort((a, b) => a.deadlineTime.getTime() - b.deadlineTime.getTime());
    })();
  }

  return gwDeadlineRowsPromise;
}

async function resolveStartGwFromTimestamp(timestamp: string | null | undefined, currentGw: number): Promise<number> {
  if (!isParseableInstant(timestamp) || !currentGw) return currentGw;
  const activatedAt = new Date(timestamp);
  if (Number.isNaN(activatedAt.getTime())) return currentGw;

  const gwDeadlineRows = await getGwDeadlineRows();
  for (const row of gwDeadlineRows) {
    if (activatedAt < row.deadlineTime) return row.gw;
  }

  if (gwDeadlineRows.length > 0) return Math.max(...gwDeadlineRows.map((row) => row.gw)) + 1;
  return currentGw;
}

export async function fetchLeagueActivationAt(leagueId: string): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from('league_members')
    .select('user_id, created_at, users(id, name, avatar_url)')
    .eq('league_id', leagueId)
    .limit(200);
  if (error) throw error;
  return getLeagueActivationAt(
    (data ?? []).map((r: { created_at?: string | null }) => ({
      created_at: typeof r.created_at === 'string' ? r.created_at : null,
    }))
  );
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

  // Web `resolveLeagueStartGw` only uses `start_gw` if already on the league object (not loaded in `useLeagueMeta`).
  if (withMeta.start_gw !== null && withMeta.start_gw !== undefined) {
    const fromObject = parseOptionalGw(withMeta.start_gw);
    if (fromObject !== null) return fromObject;
  }

  const anchorTs = withMeta.activation_at ?? withMeta.created_at;
  if (anchorTs && currentGw) {
    const anchorTime = new Date(anchorTs);

    const { data: resultsData } = await (supabase as any)
      .from('app_gw_results')
      .select('gw')
      .order('gw', { ascending: true });

    const completedGws = resultsData
      ? [...new Set((resultsData as { gw: number }[]).map((r) => r.gw))]
      : [];
    const completedOrdered = await orderCompletedGwsByFirstKickoff(supabase as any, completedGws);

    for (const gw of completedOrdered) {
      const { data: firstFixture } = await (supabase as any)
        .from('app_fixtures')
        .select('kickoff_time')
        .eq('gw', gw)
        .order('kickoff_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstFixture?.kickoff_time) {
        const firstKickoff = new Date(firstFixture.kickoff_time as string);
        const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
        if (anchorTime < deadlineTime) {
          return gw;
        }
      }
    }

    if (completedGws.length > 0) {
      return Math.max(...completedGws) + 1;
    }

    return currentGw;
  }

  return currentGw;
}

export async function resolveMemberStartGw(memberCreatedAt: string | null | undefined, fallbackStartGw: number, currentGw: number): Promise<number> {
  if (!isParseableInstant(memberCreatedAt)) return fallbackStartGw;
  const resolved = await resolveStartGwFromTimestamp(memberCreatedAt, currentGw);
  return Math.max(fallbackStartGw, resolved);
}

