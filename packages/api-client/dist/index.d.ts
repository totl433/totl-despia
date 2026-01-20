import { type HomeRanks, type HomeSnapshot } from '@totl/domain';
export interface ApiClientOptions {
    baseUrl: string;
    getAccessToken: () => Promise<string | null>;
}
export declare class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, opts: {
        status: number;
        body: unknown;
    });
}
export declare function createApiClient(opts: ApiClientOptions): {
    getHomeSnapshot(params?: {
        gw?: number;
    }): Promise<HomeSnapshot>;
    getHomeRanks(): Promise<HomeRanks>;
    registerExpoPushToken(input: {
        expoPushToken: string;
        platform?: "ios" | "android";
    }): Promise<{
        ok: true;
    }>;
    listLeagues(): Promise<{
        leagues: Array<{
            id: string;
            name: string;
            code: string;
            avatar?: string | null;
        }>;
    }>;
    getLeague(leagueId: string): Promise<{
        league: any;
        members: Array<{
            id: string;
            name: string;
        }>;
    }>;
    getLeagueGwTable(leagueId: string, gw: number): Promise<{
        leagueId: string;
        gw: number;
        rows: any[];
        submittedCount: number;
        totalMembers: number;
    }>;
    getPredictions(params?: {
        gw?: number;
    }): Promise<{
        gw: number;
        fixtures: any[];
        picks: any[];
        submitted: boolean;
    }>;
    savePredictions(input: {
        gw: number;
        picks: Array<{
            fixture_index: number;
            pick: "H" | "D" | "A";
        }>;
    }): Promise<{
        ok: true;
    }>;
    submitPredictions(input: {
        gw: number;
    }): Promise<{
        ok: true;
    }>;
    getOverallLeaderboard(): Promise<{
        rows: Array<{
            user_id: string;
            name: string | null;
            ocp: number | null;
        }>;
    }>;
    getNotificationPrefs(): Promise<{
        preferences: Record<string, boolean>;
        current_viewing_gw: number | null;
    }>;
    updateNotificationPrefs(input: {
        preferences?: Record<string, boolean>;
        current_viewing_gw?: number | null;
    }): Promise<{
        ok: true;
    }>;
};
//# sourceMappingURL=index.d.ts.map