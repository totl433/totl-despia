/**
 * Mini-league season table — same scoring rules as playtotl `League.tsx`.
 * **Start GW** uses activation vs first kickoffs in **calendar order** (not raw `gw` number order — IDs can be non-chronological).
 * **Picks** load fully via per-member paging (no 1000-row scoring cap).
 */
type LeagueRecord = {
    id: string;
    name?: string | null;
    created_at?: string | null;
    activation_at?: string | null;
    start_gw?: number | null;
};
export type LeagueSeasonTableRow = {
    user_id: string;
    name: string;
    mltPts: number;
    ocp: number;
    unicorns: number;
    wins: number;
    draws: number;
    form: ('W' | 'D' | 'L')[];
};
/** Optional: used only if the DB roster fetch returns fewer than two rows (RLS edge case) while the UI already has at least two members. */
export type MiniLeagueSeasonPreload = {
    members?: Array<{
        id: string;
        name: string;
        created_at?: string | null;
    }> | null;
    league?: {
        id: string;
        name?: string | null;
        created_at?: string | null;
        start_gw?: number | null;
    } | null;
};
/** Second member’s `league_members.created_at` — same as playtotl `getLeagueActivationAt` (ISO join strings only). */
export declare function getLeagueActivationAt(members: Array<{
    created_at?: string | null;
}> | null | undefined): string | null;
/**
 * `app_gw_results.gw` is not always chronological vs real kickoffs (e.g. id "2" can be later in the season
 * than "8"). Never iterate completed GWs by numeric `gw` when resolving activation → start GW.
 */
export declare function orderCompletedGwsByFirstKickoff(supa: any, completedGws: number[]): Promise<number[]>;
export declare function resolveLeagueStartGwWeb(supa: any, league: LeagueRecord | null | undefined, currentGw: number, opts?: {
    matchLeaguePageEffect?: boolean;
}): Promise<number>;
export type MiniLeagueSeasonComputeOptions = {
    /** When set, use this GW as the season window start (same as banner / `resolveLeagueStartGw`). */
    leagueStartGw?: number | null;
};
export declare function computeWebParityMiniLeagueSeasonRows(supa: any, leagueId: string, preload?: MiniLeagueSeasonPreload | null, options?: MiniLeagueSeasonComputeOptions | null): Promise<LeagueSeasonTableRow[]>;
export {};
//# sourceMappingURL=leagueSeasonTableWeb.d.ts.map