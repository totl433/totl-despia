import { type GwResults, type EmailPreferences, type HomeRanks, type HomeSnapshot, type ProfileSummary, type PredictionsResponse, type UnicornCard, type UserStatsData, type BrandedLeaderboard, type BrandedLeaderboardDetail, type BrandedLeaderboardBroadcastMessage, type BrandedLeaderboardBroadcastMessages, type BrandedLeaderboardBroadcastReactionToggleResponse, type BrandedLeaderboardManage, type BrandedLeaderboardStandings, type BrandedLeaderboardMyItem, type BrandedLeaderboardMembership, type BrandedLeaderboardSubscription } from '@totl/domain';
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
    getGwResults(gw: number): Promise<GwResults>;
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
            avatar_url?: string | null;
            created_at?: string | null;
        }>;
    }>;
    getLeagueAdmin(leagueId: string): Promise<{
        isAdmin: boolean;
    }>;
    getLeagueGwTable(leagueId: string, gw: number): Promise<{
        leagueId: string;
        gw: number;
        rows: Array<{
            user_id: string;
            name: string;
            avatar_url?: string | null;
            score: number;
            unicorns: number;
        }>;
        submittedUserIds: string[];
        submittedCount: number;
        totalMembers: number;
    }>;
    getGlobalGwLiveTable(gw: number): Promise<{
        gw: number;
        rows: Array<{
            user_id: string;
            name: string;
            score: number;
        }>;
    }>;
    getPredictions(params?: {
        gw?: number;
    }): Promise<PredictionsResponse>;
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
    getProfileSummary(): Promise<ProfileSummary>;
    getProfileStats(): Promise<UserStatsData>;
    getProfileUnicorns(): Promise<{
        unicorns: UnicornCard[];
    }>;
    getEmailPreferences(): Promise<{
        preferences: EmailPreferences;
    }>;
    updateEmailPreferences(input: Partial<EmailPreferences>): Promise<{
        ok: true;
        preferences: EmailPreferences;
    }>;
    submitChatMessageReport(input: {
        messageId: string;
        reason: string;
    }): Promise<{
        ok: true;
    }>;
    getBrandedLeaderboard(idOrSlug: string): Promise<BrandedLeaderboardDetail>;
    getBrandedLeaderboardStandings(id: string, params?: {
        scope?: "gw" | "month" | "season";
        gw?: number;
    }): Promise<BrandedLeaderboardStandings>;
    getBrandedLeaderboardBroadcastMessages(id: string): Promise<BrandedLeaderboardBroadcastMessages>;
    sendBrandedLeaderboardBroadcastMessage(id: string, input: {
        content: string;
    }): Promise<{
        message: BrandedLeaderboardBroadcastMessage;
    }>;
    markBrandedLeaderboardBroadcastRead(id: string, input?: {
        lastReadAt?: string | null;
    }): Promise<{
        ok: true;
        lastReadAt: string;
    }>;
    toggleBrandedLeaderboardBroadcastReaction(id: string, messageId: string, input: {
        emoji: string;
    }): Promise<BrandedLeaderboardBroadcastReactionToggleResponse>;
    getMyBrandedLeaderboards(): Promise<{
        leaderboards: BrandedLeaderboardMyItem[];
    }>;
    getManagedBrandedLeaderboards(): Promise<BrandedLeaderboardManage>;
    resolveJoinCode(code: string): Promise<{
        leaderboard: BrandedLeaderboard;
    }>;
    joinBrandedLeaderboard(id: string, code: string): Promise<{
        membership: BrandedLeaderboardMembership;
    }>;
    leaveBrandedLeaderboard(id: string): Promise<{
        ok: true;
    }>;
    restoreBrandedLeaderboard(id: string): Promise<{
        membership: BrandedLeaderboardMembership;
    }>;
    activateBrandedLeaderboardSubscription(id: string, input: {
        rc_subscription_id: string;
        rc_product_id: string;
    }): Promise<{
        subscription: BrandedLeaderboardSubscription;
    }>;
};
//# sourceMappingURL=index.d.ts.map