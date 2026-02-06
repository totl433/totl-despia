import { z } from 'zod';

export const PickSchema = z.enum(['H', 'D', 'A']);
export type Pick = z.infer<typeof PickSchema>;

export const LiveStatusSchema = z.enum(['TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'SCHEDULED']);
export type LiveStatus = z.infer<typeof LiveStatusSchema>;

export const GameweekStateSchema = z.enum(['GW_OPEN', 'GW_PREDICTED', 'LIVE', 'RESULTS_PRE_GW']);
export type GameweekState = z.infer<typeof GameweekStateSchema>;

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
export type Fixture = z.infer<typeof FixtureSchema>;

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
export type LiveScore = z.infer<typeof LiveScoreSchema>;

export const GwResultRowSchema = z.object({
  fixture_index: z.number().int().nonnegative(),
  result: PickSchema,
});
export type GwResultRow = z.infer<typeof GwResultRowSchema>;

export const PredictionPickRowSchema = z.object({
  fixture_index: z.number().int().nonnegative(),
  pick: PickSchema,
});
export type PredictionPickRow = z.infer<typeof PredictionPickRowSchema>;

export const PredictionsResponseSchema = z.object({
  gw: z.number().int().positive(),
  fixtures: z.array(FixtureSchema),
  picks: z.array(PredictionPickRowSchema),
  submitted: z.boolean(),
  // Optional for backwards compatibility; mobile treats missing as empty.
  teamForms: z.record(z.string(), z.string()).optional().default({}),
});
export type PredictionsResponse = z.infer<typeof PredictionsResponseSchema>;

export const HomeSnapshotSchema = z.object({
  currentGw: z.number().int().positive(),
  viewingGw: z.number().int().positive(),
  fixtures: z.array(FixtureSchema),
  userPicks: z.record(z.string(), PickSchema),
  liveScores: z.array(LiveScoreSchema),
  gwResults: z.array(GwResultRowSchema),
  hasSubmittedViewingGw: z.boolean(),
});
export type HomeSnapshot = z.infer<typeof HomeSnapshotSchema>;

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
export type RankBadge = z.infer<typeof RankBadgeSchema>;

export const HomeRanksSchema = z.object({
  latestGw: z.number().int().positive().nullable(),
  gwRank: RankBadgeSchema.nullable(),
  fiveWeekForm: RankBadgeSchema.nullable(),
  tenWeekForm: RankBadgeSchema.nullable(),
  seasonRank: RankBadgeSchema.nullable(),
});
export type HomeRanks = z.infer<typeof HomeRanksSchema>;

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
  mlVictoryData: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      avatar: z.string().nullable(),
    })
  ),
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
export type GwResults = z.infer<typeof GwResultsSchema>;

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
export type ProfileSummary = z.infer<typeof ProfileSummarySchema>;

export const EmailPreferencesSchema = z.object({
  new_gameweek: z.boolean(),
  results_published: z.boolean(),
  news_updates: z.boolean(),
});
export type EmailPreferences = z.infer<typeof EmailPreferencesSchema>;

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
    .array(
      z.object({
        gw: z.number().int().positive(),
        userPoints: z.number(),
        averagePoints: z.number(),
      })
    )
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
export type UserStatsData = z.infer<typeof UserStatsDataSchema>;

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
export type UnicornCard = z.infer<typeof UnicornCardSchema>;
