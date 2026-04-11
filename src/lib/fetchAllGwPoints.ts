import { supabase } from "./supabase";

export type GwPointsRow = {
  user_id: string;
  gw: number;
  points: number;
};

/**
 * Fetch the full `app_v_gw_points` dataset using paging.
 * PostgREST commonly caps unpaged responses at ~1000 rows.
 */
export async function fetchAllGwPoints(order: "asc" | "desc" = "asc"): Promise<GwPointsRow[]> {
  const rows: GwPointsRow[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("app_v_gw_points")
      .select("user_id, gw, points")
      .order("gw", { ascending: order === "asc" })
      .order("user_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

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
