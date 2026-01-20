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
  kickoff_time: z.string().datetime().nullable().optional(),
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
  kickoff_time: z.string().datetime().nullable().optional(),
  updated_at: z.string().datetime().nullable().optional(),
  goals: z.unknown().nullable().optional(),
  red_cards: z.unknown().nullable().optional(),
});
export type LiveScore = z.infer<typeof LiveScoreSchema>;

export const GwResultRowSchema = z.object({
  fixture_index: z.number().int().nonnegative(),
  result: PickSchema,
});
export type GwResultRow = z.infer<typeof GwResultRowSchema>;

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

