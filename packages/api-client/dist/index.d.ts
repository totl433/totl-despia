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
        dataSource?: "legacy";
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
    searchUsers(query: string): Promise<{
        users: Array<{
            id: string;
            name: string;
            avatarUrl: string | null;
        }>;
    }>;
    listLeagueInvites(): Promise<{
        invites: Array<{
            id: string;
            leagueId: string;
            leagueName: string;
            leagueCode: string;
            leagueAvatar: string | null;
            invitedById: string;
            invitedByName: string;
            createdAt: string;
            status: "pending" | "accepted" | "dismissed";
        }>;
    }>;
    listLeagueInvitees(leagueId: string): Promise<{
        invitees: Array<{
            userId: string;
            name: string;
            avatarUrl: string | null;
            status: "waiting" | "joined" | "declined";
            invitedAt: string;
        }>;
    }>;
    /** Invites by id when given (names can change and be long); the name is a fallback for older servers. */
    inviteToLeague(leagueId: string, username: string, userId?: string): Promise<{
        ok: true;
    }>;
    acceptLeagueInvite(inviteId: string): Promise<{
        ok: true;
        league: {
            id: string;
            name: string;
            code: string;
        };
    }>;
    dismissLeagueInvite(inviteId: string): Promise<{
        ok: true;
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
    getLeagueSeasonTable(leagueId: string): Promise<{
        rows: Array<{
            user_id: string;
            name: string;
            mltPts: number;
            ocp: number;
            unicorns: number;
            wins: number;
            draws: number;
            form: Array<"W" | "D" | "L">;
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
    deleteAccount(): Promise<{
        ok: true;
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
    listMatchCenterAdminPosts(): Promise<{
        posts: Array<{
            id: string;
            title: string;
            body: string;
            comments: boolean;
            shareable: boolean;
            reacts: boolean;
            publishedAt: string;
        }>;
    }>;
    postMatchCenterBroadcast(input: {
        title: string;
        body: string;
        comments: boolean;
        shareable: boolean;
        reacts: boolean;
    }): Promise<{
        ok: true;
        post: {
            id: string;
            title: string;
            body: string;
            comments: boolean;
            shareable: boolean;
            reacts: boolean;
            publishedAt: string;
        };
    }>;
    submitGameCentreCommentReport(input: {
        commentId: string;
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