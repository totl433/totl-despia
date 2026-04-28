import { z } from 'zod';
export const PickSchema = z.enum(['H', 'D', 'A']);
export const LiveStatusSchema = z.enum(['TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'SCHEDULED']);
export const GameweekStateSchema = z.enum(['GW_OPEN', 'GW_PREDICTED', 'LIVE', 'RESULTS_PRE_GW']);
export const FixtureSchema = z.object({
    id: z.string(),
    gw: z.number().int().positive(),
    fixture_index: z.number().int().nonnegative(),
    // Note: PostgREST timestamp formatting can vary by column type and client settings.
    // We treat these as opaque strings and let clients parse as needed.
    kickoff_time: z.string().nullable().optional(),
    api_match_id: z.number().int().nullable().optional(),
    home_team: z.string().nullable().optional(),
    away_team: z.string().nullable().optional(),
    home_name: z.string().nullable().optional(),
    away_name: z.string().nullable().optional(),
    home_code: z.string().nullable().optional(),
    away_code: z.string().nullable().optional(),
    home_crest: z.string().nullable().optional(),
    away_crest: z.string().nullable().optional(),
});
export const LiveScoreSchema = z.object({
    api_match_id: z.number().int(),
    gw: z.number().int().positive(),
    fixture_index: z.number().int().nonnegative().nullable().optional(),
    home_score: z.number().int().nullable().optional(),
    away_score: z.number().int().nullable().optional(),
    status: LiveStatusSchema.nullable().optional(),
    minute: z.number().int().nullable().optional(),
    home_team: z.string().nullable().optional(),
    away_team: z.string().nullable().optional(),
    kickoff_time: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    goals: z.unknown().nullable().optional(),
    red_cards: z.unknown().nullable().optional(),
});
export const GwResultRowSchema = z.object({
    fixture_index: z.number().int().nonnegative(),
    result: PickSchema,
});
export const PredictionPickRowSchema = z.object({
    fixture_index: z.number().int().nonnegative(),
    pick: PickSchema,
});
export const PredictionsResponseSchema = z.object({
    gw: z.number().int().positive(),
    fixtures: z.array(FixtureSchema),
    picks: z.array(PredictionPickRowSchema),
    submitted: z.boolean(),
    // Optional for backwards compatibility; mobile treats missing as empty.
    teamForms: z.record(z.string(), z.string()).optional().default({}),
    // Optional for backwards compatibility; keyed by team code (e.g. "ARS" => 2).
    teamPositions: z.record(z.string(), z.number().int().positive()).optional().default({}),
});
export const HomeSnapshotSchema = z.object({
    currentGw: z.number().int().positive(),
    viewingGw: z.number().int().positive(),
    fixtures: z.array(FixtureSchema),
    userPicks: z.record(z.string(), PickSchema),
    liveScores: z.array(LiveScoreSchema),
    gwResults: z.array(GwResultRowSchema),
    hasSubmittedViewingGw: z.boolean(),
});
export const RankBadgeSchema = z.object({
    label: z.string(),
    rank: z.number().int().positive(),
    total: z.number().int().positive(),
    // Optional helper for the UI (e.g. “Top 12%”)
    percentileLabel: z.string().nullable().optional(),
    // Optional helpers for “last GW” score display on mobile (e.g. “5/10”)
    score: z.number().int().nonnegative().optional(),
    totalFixtures: z.number().int().positive().optional(),
});
export const HomeRanksSchema = z.object({
    latestGw: z.number().int().positive().nullable(),
    gwRank: RankBadgeSchema.nullable(),
    fiveWeekForm: RankBadgeSchema.nullable(),
    tenWeekForm: RankBadgeSchema.nullable(),
    seasonRank: RankBadgeSchema.nullable(),
});
export const GwResultsSchema = z.object({
    score: z.number().int().nonnegative(),
    totalFixtures: z.number().int().positive(),
    gwRank: z.number().int().positive().nullable(),
    gwRankTotal: z.number().int().positive().nullable(),
    trophies: z.object({
        gw: z.boolean(),
        form5: z.boolean(),
        form10: z.boolean(),
        overall: z.boolean(),
    }),
    mlVictories: z.number().int().nonnegative(),
    mlVictoryNames: z.array(z.string()),
    mlVictoryData: z.array(z.object({
        id: z.string(),
        name: z.string(),
        avatar: z.string().nullable(),
    })),
    leaderboardChanges: z.object({
        overall: z.object({
            before: z.number().int().positive().nullable(),
            after: z.number().int().positive().nullable(),
            change: z.number().int().nullable(),
        }),
        form5: z.object({
            before: z.number().int().positive().nullable(),
            after: z.number().int().positive().nullable(),
            change: z.number().int().nullable(),
        }),
        form10: z.object({
            before: z.number().int().positive().nullable(),
            after: z.number().int().positive().nullable(),
            change: z.number().int().nullable(),
        }),
    }),
});
// ----------------------------
// Profile (native app)
// ----------------------------
export const ProfileSummarySchema = z.object({
    name: z.string(),
    email: z.string().nullable(),
    avatar_url: z.string().nullable(),
    isAdmin: z.boolean(),
    ocp: z.number(),
    miniLeaguesCount: z.number().int().nonnegative(),
    weeksStreak: z.number().int().nonnegative(),
});
export const EmailPreferencesSchema = z.object({
    new_gameweek: z.boolean(),
    results_published: z.boolean(),
    news_updates: z.boolean(),
});
export const UserStatsDataSchema = z.object({
    lastCompletedGw: z.number().int().positive().nullable(),
    lastCompletedGwPercentile: z.number().nullable(),
    overallPercentile: z.number().nullable(),
    correctPredictionRate: z.number().nullable(),
    bestStreak: z.number().int().nonnegative(),
    bestStreakGwRange: z.string().nullable(),
    avgPointsPerWeek: z.number().nullable(),
    bestSingleGw: z.object({ points: z.number(), gw: z.number().int().positive() }).nullable(),
    lowestSingleGw: z.object({ points: z.number(), gw: z.number().int().positive() }).nullable(),
    chaosIndex: z.number().nullable(),
    chaosCorrectCount: z.number().int().nonnegative().nullable(),
    chaosTotalCount: z.number().int().nonnegative().nullable(),
    mostCorrectTeam: z.object({ code: z.string().nullable(), name: z.string(), percentage: z.number() }).nullable(),
    mostIncorrectTeam: z.object({ code: z.string().nullable(), name: z.string(), percentage: z.number() }).nullable(),
    weeklyParData: z
        .array(z.object({
        gw: z.number().int().positive(),
        userPoints: z.number(),
        averagePoints: z.number(),
    }))
        .nullable(),
    trophyCabinet: z
        .object({
        lastGw: z.number().int().nonnegative(),
        form5: z.number().int().nonnegative(),
        form10: z.number().int().nonnegative(),
        overall: z.number().int().nonnegative(),
    })
        .nullable(),
});
// ----------------------------
// Branded Leaderboards
// ----------------------------
export const BrandedLeaderboardSchema = z.object({
    id: z.string(),
    name: z.string(),
    display_name: z.string(),
    description: z.string().nullable(),
    slug: z.string(),
    header_image_url: z.string().nullable(),
    visibility: z.enum(['public', 'private', 'unlisted']),
    price_type: z.enum(['free', 'paid']),
    season_price_cents: z.number().int(),
    currency: z.string(),
    revenue_share_pct: z.number(),
    payout_owner_id: z.string().nullable(),
    status: z.enum(['draft', 'active', 'paused', 'archived']),
    season: z.string(),
    start_gw: z.number().int().nullable(),
    rc_offering_id: z.string().nullable(),
    rc_entitlement_id: z.string().nullable(),
    rc_product_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
});
export const BrandedLeaderboardAccessReasonSchema = z.enum([
    'free_not_joined',
    'free_joined',
    'paid_not_purchased',
    'paid_purchased_not_joined',
    'paid_full_access',
]);
export const BrandedLeaderboardHostSchema = z.object({
    id: z.string(),
    leaderboard_id: z.string(),
    user_id: z.string(),
    display_order: z.number().int(),
    name: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
});
export const BrandedLeaderboardMembershipSchema = z.object({
    id: z.string(),
    leaderboard_id: z.string(),
    user_id: z.string(),
    joined_at: z.string(),
    left_at: z.string().nullable(),
    source: z.string(),
});
export const BrandedLeaderboardSubscriptionSchema = z.object({
    id: z.string(),
    leaderboard_id: z.string(),
    user_id: z.string(),
    rc_subscription_id: z.string().nullable(),
    rc_product_id: z.string().nullable(),
    status: z.enum(['active', 'expired', 'cancelled', 'billing_retry']),
    started_at: z.string(),
    expires_at: z.string().nullable(),
    cancelled_at: z.string().nullable(),
});
export const BrandedLeaderboardJoinCodeSchema = z.object({
    id: z.string(),
    code: z.string(),
    leaderboard_id: z.string(),
    expires_at: z.string().nullable(),
    max_uses: z.number().int().nullable(),
    use_count: z.number().int(),
    active: z.boolean(),
    created_at: z.string(),
});
export const BrandedLeaderboardDetailSchema = z.object({
    leaderboard: BrandedLeaderboardSchema,
    hosts: z.array(BrandedLeaderboardHostSchema),
    membership: BrandedLeaderboardMembershipSchema.nullable(),
    subscription: BrandedLeaderboardSubscriptionSchema.nullable(),
    hasAccess: z.boolean(),
    hasActivePurchase: z.boolean(),
    requiresPurchase: z.boolean(),
    accessReason: BrandedLeaderboardAccessReasonSchema,
    canPostBroadcast: z.boolean().default(false),
    broadcastUnreadCount: z.number().int().nonnegative().default(0),
});
export const BRANDED_BROADCAST_REACTION_EMOJIS = ['👍', '🔥', '👏', '🙌', '😮', '😬', '👎'];
export const BrandedBroadcastReactionEmojiSchema = z.enum(BRANDED_BROADCAST_REACTION_EMOJIS);
export const BrandedBroadcastReactionSummarySchema = z.object({
    emoji: BrandedBroadcastReactionEmojiSchema,
    count: z.number().int().nonnegative(),
    hasUserReacted: z.boolean(),
});
export const BrandedLeaderboardBroadcastMessageSchema = z.object({
    id: z.string(),
    leaderboard_id: z.string(),
    user_id: z.string(),
    content: z.string(),
    message_type: z.enum(['host', 'system']),
    seed_key: z.string().nullable(),
    created_at: z.string(),
    user_name: z.string().nullable().optional(),
    user_avatar_url: z.string().nullable().optional(),
    reactions: z.array(BrandedBroadcastReactionSummarySchema).default([]),
});
export const BrandedLeaderboardBroadcastMessagesSchema = z.object({
    messages: z.array(BrandedLeaderboardBroadcastMessageSchema),
    lastReadAt: z.string().nullable(),
});
export const BrandedLeaderboardBroadcastReactionToggleResponseSchema = z.object({
    messageId: z.string(),
    reactions: z.array(BrandedBroadcastReactionSummarySchema),
});
export const BrandedLeaderboardStandingsRowSchema = z.object({
    rank: z.number().int().positive(),
    user_id: z.string(),
    name: z.string(),
    avatar_url: z.string().nullable(),
    value: z.number(),
    is_host: z.boolean(),
    compact_values: z.array(z.number().nullable()).optional(),
});
export const BrandedLeaderboardStandingsSchema = z.object({
    rows: z.array(BrandedLeaderboardStandingsRowSchema),
    userRank: z.number().int().positive().nullable(),
});
export const BrandedLeaderboardMyItemSchema = z.object({
    leaderboard: BrandedLeaderboardSchema,
    membership: BrandedLeaderboardMembershipSchema,
    subscription: BrandedLeaderboardSubscriptionSchema.nullable(),
    canPostBroadcast: z.boolean().default(false),
});
export const BrandedLeaderboardManageItemSchema = z.object({
    leaderboard: BrandedLeaderboardSchema,
    membership: BrandedLeaderboardMembershipSchema.nullable(),
    subscription: BrandedLeaderboardSubscriptionSchema.nullable(),
    is_active: z.boolean(),
    can_restore: z.boolean(),
});
export const BrandedLeaderboardManageSchema = z.object({
    active: z.array(BrandedLeaderboardManageItemSchema),
    restorable: z.array(BrandedLeaderboardManageItemSchema),
});
export const BrandedLeaderboardPayoutSchema = z.object({
    id: z.string(),
    leaderboard_id: z.string(),
    owner_id: z.string(),
    period: z.string(),
    gross_revenue_cents: z.number().int(),
    net_revenue_cents: z.number().int(),
    totl_share_cents: z.number().int(),
    influencer_share_cents: z.number().int(),
    status: z.enum(['pending', 'paid', 'held']),
    paid_at: z.string().nullable(),
    notes: z.string().nullable(),
    created_at: z.string(),
});
export const UnicornCardSchema = z.object({
    fixture_index: z.number().int().nonnegative(),
    gw: z.number().int().positive(),
    home_team: z.string(),
    away_team: z.string(),
    home_code: z.string().nullable(),
    away_code: z.string().nullable(),
    home_name: z.string().nullable(),
    away_name: z.string().nullable(),
    kickoff_time: z.string().nullable(),
    pick: PickSchema,
    league_names: z.array(z.string()),
});
