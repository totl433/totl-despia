import { supabase } from "./supabase";

type LeagueRecord = {
  id: string;
  name?: string | null;
  created_at?: string | null;
  start_gw?: number | null;
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

function getLeagueStartOverride(name?: string | null): number | undefined {
  if (!name) return undefined;
  return LEAGUE_START_OVERRIDES[name];
}

async function ensureLeagueMeta(league: LeagueRecord): Promise<LeagueRecord> {
  const needsName = typeof league.name !== "string";
  const needsCreatedAt = typeof league.created_at !== "string";
  const needsStartGw = typeof league.start_gw === "undefined";

  if (!needsName && !needsCreatedAt && !needsStartGw) {
    return league;
  }

  const { data, error } = await supabase
    .from("leagues")
    .select("name, start_gw, created_at")
    .eq("id", league.id)
    .maybeSingle();

  if (error && (error as any)?.code === "42703") {
    const { data: fallback, error: fallbackError } = await supabase
      .from("leagues")
      .select("name, created_at")
      .eq("id", league.id)
      .maybeSingle();

    if (!fallbackError && fallback) {
      return {
        ...league,
        name: needsName ? fallback.name : league.name,
        start_gw: league.start_gw,
        created_at: needsCreatedAt ? fallback.created_at : league.created_at,
      };
    }
  }

  if (error || !data) {
    return league;
  }

  return {
    ...league,
    name: needsName ? data.name : league.name,
    start_gw: needsStartGw ? data.start_gw : league.start_gw,
    created_at: needsCreatedAt ? data.created_at : league.created_at,
  };
}

export async function resolveLeagueStartGw(
  league: LeagueRecord | null | undefined,
  currentGw: number
): Promise<number> {
  if (!league?.id) return currentGw;

  const withMeta = await ensureLeagueMeta(league);
  const override = getLeagueStartOverride(withMeta.name ?? undefined);
  if (typeof override === "number") {
    return override;
  }

  if (withMeta.start_gw !== null && withMeta.start_gw !== undefined) {
    return withMeta.start_gw;
  }

  if (withMeta.created_at && currentGw) {
    const leagueCreatedAt = new Date(withMeta.created_at);

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
        if (leagueCreatedAt <= deadlineTime) {
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
  gwDeadlines: Map<number, Date>
): boolean {
  const override = getLeagueStartOverride(league?.name);
  if (typeof override === "number") {
    return gw >= override;
  }

  if (league?.start_gw !== null && league?.start_gw !== undefined) {
    return gw >= league.start_gw;
  }

  if (league?.created_at && gwDeadlines.has(gw)) {
    const leagueCreatedAt = new Date(league.created_at);
    const gwDeadline = gwDeadlines.get(gw)!;
    return leagueCreatedAt <= gwDeadline;
  }

  return true;
}

