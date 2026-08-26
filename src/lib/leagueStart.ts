import { supabase } from "./supabase";

type LeagueRecord = {
  id: string;
  name?: string | null;
  created_at?: string | null;
  start_gw?: number | null;
};

export type LeagueStartOptions = {
  useSeasonStack?: boolean;
  seasonId?: string | null;
};

const DEADLINE_BUFFER_MINUTES = 75;

export const LEAGUE_START_OVERRIDES: Record<string, number> = {
  "Prem Predictions": 0,
  "FC Football": 0,
  "Easy League": 0,
  "API Test": 999, // Special: API Test league starts from test GW 1, not regular GW
  "The Bird league": 7,
  gregVjofVcarl: 8,
  "Let Down": 8,
};

function getLeagueStartOverride(
  name?: string | null,
  opts?: { useSeasonStack?: boolean }
): number | undefined {
  if (!name) return undefined;
  if (name === "API Test") return LEAGUE_START_OVERRIDES[name];
  // 2026/27+: last season's "started at GW7/GW8" names must not carry over.
  if (opts?.useSeasonStack) return undefined;
  return LEAGUE_START_OVERRIDES[name];
}

const seasonDeadlineRowsById = new Map<string, Promise<Array<{ gw: number; deadlineTime: Date }>>>();

async function getSeasonGwDeadlineRows(seasonId: string): Promise<Array<{ gw: number; deadlineTime: Date }>> {
  const existing = seasonDeadlineRowsById.get(seasonId);
  if (existing) return existing;
  const pending = (async () => {
    const { data, error } = await (supabase as any)
      .from("app_season_fixtures")
      .select("gw,kickoff_time")
      .eq("season_id", seasonId)
      .not("kickoff_time", "is", null)
      .order("gw", { ascending: true })
      .order("kickoff_time", { ascending: true });
    if (error) return [];

    const firstKickoffByGw = new Map<number, string>();
    (data ?? []).forEach((fixture: { gw?: number | null; kickoff_time?: string | null }) => {
      const gw = Number(fixture.gw);
      if (!Number.isFinite(gw) || firstKickoffByGw.has(gw)) return;
      if (fixture.kickoff_time) firstKickoffByGw.set(gw, fixture.kickoff_time);
    });

    const rows: Array<{ gw: number; deadlineTime: Date }> = [];
    firstKickoffByGw.forEach((kickoff, gw) => {
      const firstKickoff = new Date(kickoff);
      if (Number.isNaN(firstKickoff.getTime())) return;
      rows.push({
        gw,
        deadlineTime: new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000),
      });
    });
    return rows.sort((a, b) => a.deadlineTime.getTime() - b.deadlineTime.getTime());
  })();
  seasonDeadlineRowsById.set(seasonId, pending);
  return pending;
}

function resolveStartGwFromDeadlineRows(
  timestamp: string | null | undefined,
  currentGw: number,
  rows: Array<{ gw: number; deadlineTime: Date }>
): number {
  if (!timestamp || !currentGw) return currentGw;
  const activatedAt = new Date(timestamp);
  if (Number.isNaN(activatedAt.getTime())) return currentGw;
  for (const row of rows) {
    if (activatedAt < row.deadlineTime) return row.gw;
  }
  if (rows.length > 0) return Math.max(...rows.map((row) => row.gw)) + 1;
  return currentGw;
}

async function ensureLeagueMeta(league: LeagueRecord): Promise<LeagueRecord> {
  const needsName = typeof league.name !== "string";
  const needsCreatedAt = typeof league.created_at !== "string";

  // NOTE: start_gw column doesn't exist in production database
  // We rely on LEAGUE_START_OVERRIDES or calculate from created_at instead

  if (!needsName && !needsCreatedAt) {
    return league;
  }

  // Only fetch name and created_at - start_gw doesn't exist
  const { data, error } = await supabase
    .from("leagues")
    .select("name, created_at")
    .eq("id", league.id)
    .maybeSingle();

  if (error || !data) {
    return league;
  }

  return {
    ...league,
    name: needsName ? data.name : league.name,
    created_at: needsCreatedAt ? data.created_at : league.created_at,
  };
}

export async function resolveLeagueStartGw(
  league: LeagueRecord | null | undefined,
  currentGw: number,
  options?: LeagueStartOptions
): Promise<number> {
  if (!league?.id) return currentGw;

  const withMeta = await ensureLeagueMeta(league);
  const useSeasonStack = !!options?.useSeasonStack;
  const seasonId = typeof options?.seasonId === "string" && options.seasonId ? options.seasonId : null;
  const override = getLeagueStartOverride(withMeta.name ?? undefined, { useSeasonStack });
  if (typeof override === "number") {
    return override;
  }

  if (useSeasonStack) {
    const rows = seasonId ? await getSeasonGwDeadlineRows(seasonId) : [];
    if (rows.length === 0) return currentGw;
    return resolveStartGwFromDeadlineRows(withMeta.created_at, currentGw, rows);
  }

  if (withMeta.start_gw !== null && withMeta.start_gw !== undefined) {
    return withMeta.start_gw;
  }

  if (withMeta.created_at && currentGw) {
    const leagueCreatedAt = new Date(withMeta.created_at);

    // Safeguard: leagues created very recently are always treated as new (never lock).
    const NEW_LEAGUE_GRACE_DAYS = 5;
    const hoursSinceCreation = (Date.now() - leagueCreatedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation < NEW_LEAGUE_GRACE_DAYS * 24) return currentGw;

    const { data: resultsData } = await supabase
      .from("gw_results")
      .select("gw")
      .order("gw", { ascending: true });

    const completedGws = resultsData ? [...new Set(resultsData.map((r) => r.gw))] : [];

    for (const gw of completedGws) {
      const { data: firstFixture } = await supabase
        .from("fixtures")
        .select("kickoff_time")
        .eq("gw", gw)
        .order("kickoff_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstFixture?.kickoff_time) {
        const firstKickoff = new Date(firstFixture.kickoff_time);
        const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
        // League can participate if created BEFORE the deadline (strictly less than)
        if (leagueCreatedAt < deadlineTime) {
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

export function shouldIncludeGwForLeague(
  league: LeagueRecord | null | undefined,
  gw: number,
  gwDeadlines: Map<number, Date>,
  options?: LeagueStartOptions
): boolean {
  // Special handling for API Test league - always include any test GW (1, 2, 3, etc.)
  // Test GWs are independent of regular GWs, so we don't filter them
  if (league?.name === "API Test") {
    return true;
  }
  
  const override = getLeagueStartOverride(league?.name, { useSeasonStack: options?.useSeasonStack });
  if (typeof override === "number") {
    // For API Test with override 999, always include (handled above)
    if (override === 999) {
      return true; // All test GWs allowed for API Test
    }
    return gw >= override;
  }

  if (!options?.useSeasonStack && league?.start_gw !== null && league?.start_gw !== undefined) {
    return gw >= league.start_gw;
  }

  if (league?.created_at && gwDeadlines.has(gw)) {
    const leagueCreatedAt = new Date(league.created_at);
    const gwDeadline = gwDeadlines.get(gw)!;
    // League can participate if created BEFORE the deadline (strictly less than)
    return leagueCreatedAt < gwDeadline;
  }

  return true;
}

