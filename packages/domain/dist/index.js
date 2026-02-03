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
