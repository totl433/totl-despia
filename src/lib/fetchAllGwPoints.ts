import { supabase } from "./supabase";

export type GwPointsRow = {
  user_id: string;
  gw: number;
  points: number;
};

export type FetchGwPointsOptions = {
  /** When set, reads app_v_season_gw_points for that season (Pile B). */
  seasonId?: string | null;
};

/**
 * Fetch full GW points dataset using paging.
 * Legacy: app_v_gw_points. Season stack: app_v_season_gw_points filtered by season_id.
 * PostgREST commonly caps unpaged responses at ~1000 rows.
 */
export async function fetchAllGwPoints(
  order: "asc" | "desc" = "asc",
  options?: FetchGwPointsOptions
): Promise<GwPointsRow[]> {
  const rows: GwPointsRow[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  const seasonId = options?.seasonId ?? null;
  const table = seasonId ? "app_v_season_gw_points" : "app_v_gw_points";

  while (true) {
    let q = (supabase as any)
      .from(table)
      .select("user_id, gw, points")
      .order("gw", { ascending: order === "asc" })
      .order("user_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (seasonId) {
      q = q.eq("season_id", seasonId);
    }

    const { data, error } = await q;

    if (error) throw error;

    const page = (data ?? []) as GwPointsRow[];
    if (page.length === 0) break;

    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

export type OverallOcpRow = {
  user_id: string;
  name: string | null;
  ocp: number | null;
};

/**
 * Overall OCP for legacy or a Pile B season.
 */
export async function fetchOverallOcp(options?: {
  seasonId?: string | null;
  limit?: number;
}): Promise<OverallOcpRow[]> {
  const seasonId = options?.seasonId ?? null;
  const table = seasonId ? "app_v_season_ocp_overall" : "app_v_ocp_overall";
  let q = (supabase as any)
    .from(table)
    .select("user_id, name, ocp")
    .order("ocp", { ascending: false });

  if (seasonId) {
    q = q.eq("season_id", seasonId);
  }
  if (options?.limit) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as OverallOcpRow[];
}
