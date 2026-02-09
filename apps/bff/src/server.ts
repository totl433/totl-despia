import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import {
  FixtureSchema,
  GwResultRowSchema,
  GwResultsSchema,
  HomeRanksSchema,
  HomeSnapshotSchema,
  LiveScoreSchema,
  type HomeRanks,
  type HomeSnapshot,
  type Pick,
} from '@totl/domain';

import { loadEnv } from './env.js';
import { createSupabaseClient } from './supabase.js';
import { requireUser } from './auth.js';
import { captureException, initSentry } from './sentry.js';
import { computeGwResults } from './gwResults.js';
import {
  getEmailPreferences,
  getProfileStats,
  getProfileSummary,
  getProfileUnicorns,
  updateEmailPreferences,
} from './profile.js';

const env = loadEnv(process.env);
const supabase = createSupabaseClient(env);
initSentry();

const app = Fastify({
  logger: true,
});

await app.register(helmet);
await app.register(cors, {
  origin: env.CORS_ORIGIN ?? true,
});

app.setErrorHandler((err, req, reply) => {
  const statusCode =
    typeof (err as any)?.statusCode === 'number' ? (err as any).statusCode : 500;

  const message = err instanceof Error ? err.message : String(err);
  req.log.error({ err }, 'request failed');
  captureException(err);
  reply.status(statusCode).send({
    error: statusCode === 500 ? 'InternalServerError' : 'RequestError',
    message,
  });
});

app.get('/v1/health', async () => ({ ok: true }));

function getAuthedSupa(req: any) {
  const userId = req.userId as string;
  const accessToken = req.accessToken as string;
  return { userId, supa: createSupabaseClient(env, { bearerToken: accessToken }) };
}

const GwParamsSchema = z.object({
  gw: z.coerce.number().int().positive(),
});

const HomeQuerySchema = z.object({
  gw: z.coerce.number().int().positive().optional(),
});

const RegisterExpoTokenBodySchema = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(['ios', 'android']).optional(),
});

app.post('/v1/push/register', async (req) => {
  await requireUser(req, supabase);
  const userId = (req as any).userId as string;
  const accessToken = (req as any).accessToken as string;

  const body = RegisterExpoTokenBodySchema.parse((req as any).body);
  const supa = createSupabaseClient(env, { bearerToken: accessToken });

  const { error } = await (supa as any)
    .from('expo_push_tokens')
    .upsert(
      {
        user_id: userId,
        expo_push_token: body.expoPushToken,
        platform: body.platform ?? null,
        is_active: true,
      },
      { onConflict: 'user_id,expo_push_token' }
    );

  if (error) throw error;
  return { ok: true };
});

app.get('/v1/gw/:gw/results', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const params = GwParamsSchema.parse((req as any).params);
  const out = await computeGwResults({ userId, gw: params.gw, supa });
  return GwResultsSchema.parse(out);
});

app.get('/v1/home', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);

  const query = HomeQuerySchema.parse((req as any).query);

  // Use an authed client so all reads respect RLS and user context.
  const { data: meta, error: metaError } = await (supa as any)
    .from('app_meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();
  if (metaError) throw metaError;

  const currentGw = (meta?.current_gw as number | null) ?? 1;

  const { data: prefs } = await (supa as any)
    .from('user_notification_preferences')
    .select('current_viewing_gw')
    .eq('user_id', userId)
    .maybeSingle();

  const userViewingGw: number | null = prefs?.current_viewing_gw ?? null;
  const defaultViewingGw = userViewingGw !== null && userViewingGw < currentGw ? userViewingGw : currentGw;
  const viewingGw = query.gw ?? defaultViewingGw;

  const [
    fixturesRes,
    picksRes,
    liveScoresRes,
    gwResultsRes,
    submissionRes,
  ] = await Promise.all([
    (supa as any)
      .from('app_fixtures')
      .select('*')
      .eq('gw', viewingGw)
      .order('fixture_index', { ascending: true }),

    (supa as any)
      .from('app_picks')
      .select('fixture_index, pick')
      .eq('user_id', userId)
      .eq('gw', viewingGw),

    (supa as any).from('live_scores').select('*').eq('gw', viewingGw),

    (supa as any)
      .from('app_gw_results')
      .select('fixture_index, result')
      .eq('gw', viewingGw),

    (supa as any)
      .from('app_gw_submissions')
      .select('submitted_at')
      .eq('user_id', userId)
      .eq('gw', viewingGw)
      .maybeSingle(),
  ]);

  if (fixturesRes.error) throw fixturesRes.error;
  if (picksRes.error) throw picksRes.error;
  if (liveScoresRes.error) throw liveScoresRes.error;
  if (gwResultsRes.error) throw gwResultsRes.error;
  if (submissionRes.error) throw submissionRes.error;

  const fixtures: HomeSnapshot['fixtures'] = [];
  for (const f of (fixturesRes.data ?? []) as unknown[]) {
    const parsed = FixtureSchema.safeParse(f);
    if (parsed.success) fixtures.push(parsed.data);
    else req.log.warn({ issues: parsed.error.issues }, 'dropping invalid fixture row');
  }

  const userPicks: Record<string, Pick> = {};
  for (const p of (picksRes.data ?? []) as Array<{ fixture_index: number; pick: Pick }>) {
    userPicks[String(p.fixture_index)] = p.pick;
  }

  const liveScores: HomeSnapshot['liveScores'] = [];
  for (const ls of (liveScoresRes.data ?? []) as unknown[]) {
    const parsed = LiveScoreSchema.safeParse(ls);
    if (parsed.success) liveScores.push(parsed.data);
    else req.log.warn({ issues: parsed.error.issues }, 'dropping invalid live score row');
  }

  const gwResults: HomeSnapshot['gwResults'] = [];
  for (const r of (gwResultsRes.data ?? []) as unknown[]) {
    const parsed = GwResultRowSchema.safeParse(r);
    if (parsed.success) gwResults.push(parsed.data);
    else req.log.warn({ issues: parsed.error.issues }, 'dropping invalid gw result row');
  }

  const snapshot: HomeSnapshot = {
    currentGw,
    viewingGw,
    fixtures,
    userPicks,
    liveScores,
    gwResults,
    hasSubmittedViewingGw: !!submissionRes.data?.submitted_at,
  };

  const validated = HomeSnapshotSchema.safeParse(snapshot);
  if (!validated.success) {
    req.log.error({ issues: validated.error.issues }, 'home snapshot failed validation');
    throw validated.error;
  }
  return validated.data;
});

function makeRankBadge(input: {
  label: string;
  rank: number | null;
  total: number;
  score?: number;
  totalFixtures?: number;
}): { label: string; rank: number; total: number; percentileLabel: string; score?: number; totalFixtures?: number } | null {
  if (!input.rank || input.total <= 0) return null;
  const pct = Math.max(1, Math.min(100, Math.round((input.rank / input.total) * 100)));
  return {
    label: input.label,
    rank: input.rank,
    total: input.total,
    percentileLabel: `Top ${pct}%`,
    ...(typeof input.score === 'number' ? { score: input.score } : {}),
    ...(typeof input.totalFixtures === 'number' ? { totalFixtures: input.totalFixtures } : {}),
  };
}

function rankFromSorted(scores: Array<{ user_id: string; score: number }>, userId: string): { rank: number | null; total: number } {
  const total = scores.length;
  const idx = scores.findIndex((r) => r.user_id === userId);
  if (idx === -1) return { rank: null, total };
  // Handle ties: rank is 1 + number of strictly higher scores.
  const myScore = scores[idx].score;
  const higher = scores.filter((r) => r.score > myScore).length;
  return { rank: higher + 1, total };
}

app.get('/v1/home/ranks', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);

  // Latest completed GW (used for “Gameweek X” and form windows)
  const { data: latestRes, error: latestErr } = await (supa as any)
    .from('app_gw_results')
    .select('gw')
    .order('gw', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;
  const latestGw: number | null = (latestRes?.gw as number | null) ?? null;

  // Season rank from ocp view (top 200 is fine for now; will expand later if needed)
  const { data: ocpRows, error: ocpErr } = await (supa as any)
    .from('app_v_ocp_overall')
    .select('user_id, ocp')
    .order('ocp', { ascending: false })
    .limit(500);
  if (ocpErr) throw ocpErr;
  const ocpScores = (ocpRows ?? [])
    .map((r: any) => ({ user_id: r.user_id as string, score: Number(r.ocp ?? 0) }))
    .filter((r: any) => r.user_id);
  const season = rankFromSorted(ocpScores, userId);

  // If we don't have a latest GW yet, return what we can.
  if (!latestGw) {
    const out: HomeRanks = {
      latestGw: null,
      gwRank: null,
      fiveWeekForm: null,
      tenWeekForm: null,
      seasonRank: makeRankBadge({ label: 'Season', rank: season.rank, total: season.total }),
    };
    return HomeRanksSchema.parse(out);
  }

  // Pull recent GW points window (last 10) and last GW
  const minGw = Math.max(1, latestGw - 9);
  const { data: gwPointsRows, error: gwPointsErr } = await (supa as any)
    .from('app_v_gw_points')
    .select('user_id, gw, points')
    .gte('gw', minGw)
    .lte('gw', latestGw)
    .order('gw', { ascending: true })
    .limit(20000);
  if (gwPointsErr) throw gwPointsErr;

  // Determine participant set from season leaderboard (fallback to gw points)
  const participantIds = new Set<string>(ocpScores.map((r: { user_id: string; score: number }) => r.user_id));
  (gwPointsRows ?? []).forEach((r: any) => {
    if (typeof r?.user_id === 'string') participantIds.add(r.user_id);
  });

  const pointsByUserByGw = new Map<string, Map<number, number>>();
  (gwPointsRows ?? []).forEach((r: any) => {
    const uid = r.user_id as string | undefined;
    const gw = Number(r.gw);
    const pts = Number(r.points ?? 0);
    if (!uid || !Number.isFinite(gw)) return;
    const byGw = pointsByUserByGw.get(uid) ?? new Map<number, number>();
    byGw.set(gw, Number.isFinite(pts) ? pts : 0);
    pointsByUserByGw.set(uid, byGw);
  });

  const lastGwScores: Array<{ user_id: string; score: number }> = [];
  participantIds.forEach((uid) => {
    const pts = pointsByUserByGw.get(uid)?.get(latestGw) ?? 0;
    lastGwScores.push({ user_id: uid, score: pts });
  });
  lastGwScores.sort((a, b) => b.score - a.score);
  const gwRank = rankFromSorted(lastGwScores, userId);
  const myLatestGwScore = pointsByUserByGw.get(userId)?.get(latestGw) ?? 0;

  const { count: latestGwFixtureCount, error: latestGwFxErr } = await (supa as any)
    .from('app_fixtures')
    .select('id', { count: 'exact', head: true })
    .eq('gw', latestGw);
  if (latestGwFxErr) throw latestGwFxErr;
  const myLatestGwTotalFixtures = Number(latestGwFixtureCount ?? 0) || 0;

  const sumWindow = (windowSize: number) => {
    const start = Math.max(1, latestGw - (windowSize - 1));
    const scores: Array<{ user_id: string; score: number }> = [];
    participantIds.forEach((uid) => {
      let sum = 0;
      const byGw = pointsByUserByGw.get(uid);
      for (let g = start; g <= latestGw; g++) sum += byGw?.get(g) ?? 0;
      scores.push({ user_id: uid, score: sum });
    });
    scores.sort((a, b) => b.score - a.score);
    return rankFromSorted(scores, userId);
  };

  const five = sumWindow(5);
  const ten = sumWindow(10);

  const out: HomeRanks = {
    latestGw,
    gwRank: makeRankBadge({
      label: `GW ${latestGw}`,
      rank: gwRank.rank,
      total: gwRank.total,
      score: myLatestGwScore,
      totalFixtures: myLatestGwTotalFixtures || undefined,
    }),
    fiveWeekForm: makeRankBadge({ label: '5-week form', rank: five.rank, total: five.total }),
    tenWeekForm: makeRankBadge({ label: '10-week form', rank: ten.rank, total: ten.total }),
    seasonRank: makeRankBadge({ label: 'Season', rank: season.rank, total: season.total }),
  };
  return HomeRanksSchema.parse(out);
});

app.get('/v1/leagues', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);

  const { data, error } = await (supa as any)
    .from('league_members')
    .select('league_id, leagues(id, name, code, avatar, created_at)')
    .eq('user_id', userId);
  if (error) throw error;

  const leagues = (data ?? [])
    .map((r: any) => r.leagues)
    .filter(Boolean);

  return { leagues };
});

const LeagueParamsSchema = z.object({
  leagueId: z.string().uuid(),
});

app.get('/v1/leagues/:leagueId', async (req) => {
  await requireUser(req, supabase);
  const { supa } = getAuthedSupa(req as any);
  const params = LeagueParamsSchema.parse((req as any).params);

  const [leagueRes, membersRes] = await Promise.all([
    (supa as any).from('leagues').select('id, name, code, avatar, created_at').eq('id', params.leagueId).maybeSingle(),
    (supa as any)
      .from('league_members')
      .select('user_id, users(id, name, avatar_url)')
      .eq('league_id', params.leagueId)
      .limit(200),
  ]);

  if (leagueRes.error) throw leagueRes.error;
  if (membersRes.error) throw membersRes.error;
  if (!leagueRes.data) throw Object.assign(new Error('League not found'), { statusCode: 404 });

  const members = (membersRes.data ?? []).map((m: any) => ({
    id: m.users?.id ?? m.user_id,
    name: m.users?.name ?? 'User',
    avatar_url: m.users?.avatar_url ?? null,
  }));

  return { league: leagueRes.data, members };
});

const PredictionsQuerySchema = z.object({
  gw: z.coerce.number().int().positive().optional(),
});

app.get('/v1/predictions', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const query = PredictionsQuerySchema.parse((req as any).query);

  const { data: meta, error: metaError } = await (supa as any)
    .from('app_meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();
  if (metaError) throw metaError;
  const currentGw = (meta?.current_gw as number | null) ?? 1;

  const gw = query.gw ?? currentGw;

  const [fixturesRes, picksRes, submissionRes, formsRes] = await Promise.all([
    (supa as any)
      .from('app_fixtures')
      .select('*')
      .eq('gw', gw)
      .order('fixture_index', { ascending: true }),
    (supa as any)
      .from('app_picks')
      .select('fixture_index, pick')
      .eq('user_id', userId)
      .eq('gw', gw),
    (supa as any)
      .from('app_gw_submissions')
      .select('submitted_at')
      .eq('user_id', userId)
      .eq('gw', gw)
      .maybeSingle(),
    (supa as any).from('app_team_forms').select('team_code, form').eq('gw', gw),
  ]);

  if (fixturesRes.error) throw fixturesRes.error;
  if (picksRes.error) throw picksRes.error;
  if (submissionRes.error) throw submissionRes.error;
  if (formsRes.error) throw formsRes.error;

  const teamForms: Record<string, string> = {};
  (formsRes.data ?? []).forEach((row: any) => {
    const code = typeof row?.team_code === 'string' ? row.team_code.trim().toUpperCase() : '';
    const form = typeof row?.form === 'string' ? row.form.trim().toUpperCase() : '';
    if (code && form) teamForms[code] = form;
  });

  return {
    gw,
    fixtures: fixturesRes.data ?? [],
    picks: picksRes.data ?? [],
    submitted: !!submissionRes.data?.submitted_at,
    teamForms,
  };
});

const SavePicksBodySchema = z.object({
  gw: z.number().int().positive(),
  picks: z.array(z.object({ fixture_index: z.number().int().nonnegative(), pick: z.enum(['H', 'D', 'A']) })),
});

app.post('/v1/predictions/save', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const body = SavePicksBodySchema.parse((req as any).body);

  if (body.picks.length === 0) return { ok: true };

  const rows = body.picks.map((p) => ({
    user_id: userId,
    gw: body.gw,
    fixture_index: p.fixture_index,
    pick: p.pick,
  }));

  const { error } = await (supa as any).from('app_picks').upsert(rows, { onConflict: 'user_id,gw,fixture_index' });
  if (error) throw error;
  return { ok: true };
});

const SubmitPredictionsBodySchema = z.object({
  gw: z.number().int().positive(),
});

app.post('/v1/predictions/submit', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const body = SubmitPredictionsBodySchema.parse((req as any).body);

  const { error } = await (supa as any)
    .from('app_gw_submissions')
    .upsert(
      { user_id: userId, gw: body.gw, submitted_at: new Date().toISOString() },
      { onConflict: 'user_id,gw' }
    );
  if (error) throw error;
  return { ok: true };
});

app.get('/v1/leaderboards/overall', async (req) => {
  await requireUser(req, supabase);
  const { supa } = getAuthedSupa(req as any);

  const { data, error } = await (supa as any)
    .from('app_v_ocp_overall')
    .select('user_id, name, ocp')
    .order('ocp', { ascending: false })
    .limit(200);
  if (error) throw error;
  return { rows: data ?? [] };
});

app.get('/v1/profile/summary', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const accessToken = (req as any).accessToken as string;
  return getProfileSummary({ userId, supa, accessToken, rootSupabase: supabase });
});

app.get('/v1/profile/stats', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  return getProfileStats({ userId, supa });
});

app.get('/v1/profile/unicorns', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  return { unicorns: await getProfileUnicorns({ userId, supa }) };
});

app.get('/v1/email-preferences', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  return { preferences: await getEmailPreferences({ userId, supa }) };
});

const UpdateEmailPreferencesBodySchema = z
  .object({
    new_gameweek: z.boolean().optional(),
    results_published: z.boolean().optional(),
    news_updates: z.boolean().optional(),
  })
  .strict();

app.put('/v1/email-preferences', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const accessToken = (req as any).accessToken as string;
  const body = UpdateEmailPreferencesBodySchema.parse((req as any).body);
  const { data: authData } = await (supabase as any).auth.getUser(accessToken);
  const email = (authData?.user?.email as string | null) ?? null;
  const next = await updateEmailPreferences({ userId, supa, email, input: body });
  return { ok: true, preferences: next };
});

app.get('/v1/leagues/:leagueId/gw/:gw/table', async (req) => {
  await requireUser(req, supabase);
  const { supa } = getAuthedSupa(req as any);
  const params = z
    .object({ leagueId: z.string().uuid(), gw: z.coerce.number().int().positive() })
    .parse((req as any).params);

  const leagueId = params.leagueId;
  const gw = params.gw;

  const [membersRes, submissionsRes, picksRes, liveScoresRes, resultsRes, fixturesRes] = await Promise.all([
    (supa as any)
      .from('league_members')
      .select('user_id, users(id, name, avatar_url)')
      .eq('league_id', leagueId)
      .limit(200),
    (supa as any).from('app_gw_submissions').select('user_id').eq('gw', gw),
    (supa as any).from('app_picks').select('user_id, fixture_index, pick').eq('gw', gw),
    (supa as any).from('live_scores').select('api_match_id, fixture_index, home_score, away_score, status').eq('gw', gw),
    (supa as any).from('app_gw_results').select('fixture_index, result').eq('gw', gw),
    (supa as any).from('app_fixtures').select('fixture_index, api_match_id').eq('gw', gw),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (submissionsRes.error) throw submissionsRes.error;
  if (picksRes.error) throw picksRes.error;
  if (liveScoresRes.error) throw liveScoresRes.error;
  if (resultsRes.error) throw resultsRes.error;
  if (fixturesRes.error) throw fixturesRes.error;

  const members = (membersRes.data ?? []).map((m: any) => ({
    user_id: m.user_id,
    name: m.users?.name ?? 'User',
    avatar_url: m.users?.avatar_url ?? null,
  }));
  const memberIds = new Set(members.map((m: { user_id: string; name: string; avatar_url: string | null }) => m.user_id));
  const submittedIds = new Set(
    ((submissionsRes.data ?? []) as any[])
      .map((s: any) => s.user_id as string)
      .filter((id: string) => memberIds.has(id))
  );

  const outcomeByFixtureIndex = new Map<number, 'H' | 'D' | 'A'>();
  const results = resultsRes.data ?? [];
  results.forEach((r: any) => {
    if (r.result === 'H' || r.result === 'D' || r.result === 'A') outcomeByFixtureIndex.set(r.fixture_index, r.result);
  });

  // If live scores exist, derive live outcomes for started games and overwrite results for those fixtures.
  const fixtures = fixturesRes.data ?? [];
  const apiMatchIdToFixtureIndex = new Map<number, number>();
  fixtures.forEach((f: any) => {
    if (typeof f.api_match_id === 'number') apiMatchIdToFixtureIndex.set(f.api_match_id, f.fixture_index);
  });

  (liveScoresRes.data ?? []).forEach((ls: any) => {
    const status = ls.status;
    const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED';
    if (!started) return;
    const fixtureIndex =
      typeof ls.fixture_index === 'number'
        ? ls.fixture_index
        : typeof ls.api_match_id === 'number'
          ? apiMatchIdToFixtureIndex.get(ls.api_match_id)
          : undefined;
    if (fixtureIndex === undefined) return;
    const hs = Number(ls.home_score ?? 0);
    const as = Number(ls.away_score ?? 0);
    const out: 'H' | 'D' | 'A' = hs > as ? 'H' : hs < as ? 'A' : 'D';
    outcomeByFixtureIndex.set(fixtureIndex, out);
  });

  const picks = (picksRes.data ?? []).filter((p: any) => memberIds.has(p.user_id));
  const picksByFixtureIndex = new Map<number, Array<{ user_id: string; pick: 'H' | 'D' | 'A' }>>();
  picks.forEach((p: any) => {
    if (!submittedIds.has(p.user_id)) return;
    const arr = picksByFixtureIndex.get(p.fixture_index) ?? [];
    arr.push({ user_id: p.user_id, pick: p.pick });
    picksByFixtureIndex.set(p.fixture_index, arr);
  });

  const rows = members
    .filter((m: { user_id: string; name: string; avatar_url: string | null }) => submittedIds.has(m.user_id))
    .map((m: { user_id: string; name: string; avatar_url: string | null }) => ({
      user_id: m.user_id,
      name: m.name,
      avatar_url: m.avatar_url,
      score: 0,
      unicorns: 0,
    }));

  outcomeByFixtureIndex.forEach((outcome, fixtureIndex) => {
    const thesePicks = picksByFixtureIndex.get(fixtureIndex) ?? [];
    const correctIds = thesePicks.filter((p) => p.pick === outcome).map((p) => p.user_id);

    correctIds.forEach((uid) => {
      const r = rows.find((x: { user_id: string }) => x.user_id === uid);
      if (r) r.score += 1;
    });

    if (correctIds.length === 1 && submittedIds.size >= 3) {
      const r = rows.find((x: { user_id: string }) => x.user_id === correctIds[0]);
      if (r) r.unicorns += 1;
    }
  });

  rows.sort(
    (a: { score: number; unicorns: number; name: string }, b: { score: number; unicorns: number; name: string }) =>
      b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name)
  );
  const submittedUserIds = Array.from(submittedIds).map(String).sort();
  return { leagueId, gw, rows, submittedUserIds, submittedCount: submittedIds.size, totalMembers: members.length };
});

app.get('/v1/notification-prefs', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);

  const { data, error } = await (supa as any)
    .from('user_notification_preferences')
    .select('preferences, current_viewing_gw')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  return {
    preferences: data?.preferences ?? {},
    current_viewing_gw: data?.current_viewing_gw ?? null,
  };
});

const UpdateNotificationPrefsBodySchema = z.object({
  preferences: z.record(z.string(), z.boolean()).optional(),
  current_viewing_gw: z.number().int().positive().nullable().optional(),
});

app.put('/v1/notification-prefs', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const body = UpdateNotificationPrefsBodySchema.parse((req as any).body);

  const { data: existing } = await (supa as any)
    .from('user_notification_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();

  const mergedPrefs = {
    ...(existing?.preferences ?? {}),
    ...(body.preferences ?? {}),
  };

  const { error } = await (supa as any)
    .from('user_notification_preferences')
    .upsert(
      {
        user_id: userId,
        preferences: mergedPrefs,
        current_viewing_gw: body.current_viewing_gw ?? undefined,
      },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
  return { ok: true };
});

await app.listen({ port: env.PORT, host: '0.0.0.0' });

