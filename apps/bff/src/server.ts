import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { HomeSnapshotSchema, type HomeSnapshot, type Pick } from '@totl/domain';

import { loadEnv } from './env';
import { createSupabaseClient } from './supabase';
import { requireUser } from './auth';
import { captureException, initSentry } from './sentry';

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

  const userPicks: Record<string, Pick> = {};
  for (const p of (picksRes.data ?? []) as Array<{ fixture_index: number; pick: Pick }>) {
    userPicks[String(p.fixture_index)] = p.pick;
  }

  const snapshot: HomeSnapshot = {
    currentGw,
    viewingGw,
    fixtures: fixturesRes.data ?? [],
    userPicks,
    liveScores: liveScoresRes.data ?? [],
    gwResults: (gwResultsRes.data ?? []).filter((r: any) => r.result === 'H' || r.result === 'D' || r.result === 'A'),
    hasSubmittedViewingGw: !!submissionRes.data?.submitted_at,
  };

  return HomeSnapshotSchema.parse(snapshot);
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
      .select('user_id, users(id, name)')
      .eq('league_id', params.leagueId)
      .limit(200),
  ]);

  if (leagueRes.error) throw leagueRes.error;
  if (membersRes.error) throw membersRes.error;
  if (!leagueRes.data) throw Object.assign(new Error('League not found'), { statusCode: 404 });

  const members = (membersRes.data ?? []).map((m: any) => ({
    id: m.users?.id ?? m.user_id,
    name: m.users?.name ?? 'User',
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

  const [fixturesRes, picksRes, submissionRes] = await Promise.all([
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
  ]);

  if (fixturesRes.error) throw fixturesRes.error;
  if (picksRes.error) throw picksRes.error;
  if (submissionRes.error) throw submissionRes.error;

  return {
    gw,
    fixtures: fixturesRes.data ?? [],
    picks: picksRes.data ?? [],
    submitted: !!submissionRes.data?.submitted_at,
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
      .select('user_id, users(id, name)')
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
  }));
  const memberIds = new Set(members.map((m: { user_id: string; name: string }) => m.user_id));
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
    .filter((m: { user_id: string; name: string }) => submittedIds.has(m.user_id))
    .map((m: { user_id: string; name: string }) => ({ user_id: m.user_id, name: m.name, score: 0, unicorns: 0 }));

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
  return { leagueId, gw, rows, submittedCount: submittedIds.size, totalMembers: members.length };
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

