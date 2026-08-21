import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import {
  computeWebParityMiniLeagueSeasonRows,
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
import { createSupabaseAdminClient, createSupabaseClient } from './supabase.js';
import { requireUser } from './auth.js';
import { captureException, initSentry } from './sentry.js';
import { computeGwResults } from './gwResults.js';
import { computeLiveGwScoresForGw } from './liveGwScores.js';
import { buildHostReviewLink } from './hostReviewLinks.js';
import {
  getEmailPreferences,
  getProfileStats,
  getProfileSummary,
  getProfileUnicorns,
  updateEmailPreferences,
} from './profile.js';
import { sendChatMessageReportEmail, sendHostReviewReadyEmail } from './reporting.js';
import { registerBrandedLeaderboardRoutes } from './brandedLeaderboards.js';
import { notifyFinalSubmissionForLeagues } from './finalSubmissionNotifications.js';
import {
  applySeasonFilter,
  getSeasonTables,
  resolveSeasonCtx,
  seasonDisplayGw,
} from './seasonStack.js';
import { resolveTeamFormsAndPositions } from './teamFormStandings.js';

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

  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && typeof (err as any).message === 'string'
        ? (err as any).message
        : String(err);
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
  /**
   * Force pile-A (legacy app_*) tables. Use when a season-stack user opens a prior-season
   * score sheet (e.g. 2025/26) so GW fixtures/picks don't read empty pile B folders.
   */
  dataSource: z.enum(['legacy']).optional(),
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

  // Dual-stack: testers with use_season_stack → Pile B; everyone else → legacy app_*
  // dataSource=legacy forces pile A (score sheets / Round Up for completed 2025/26).
  let seasonCtx = await resolveSeasonCtx(supa as any, userId);
  if (query.dataSource === 'legacy') {
    const { data: meta } = await (supa as any).from('app_meta').select('current_gw').eq('id', 1).maybeSingle();
    seasonCtx = {
      useSeasonStack: false,
      seasonId: null,
      seasonLabel: null,
      currentGw: (meta?.current_gw as number | null) ?? seasonCtx.currentGw ?? 1,
      viewingGw: query.gw ?? seasonCtx.viewingGw,
    };
    req.log.info({ gw: query.gw ?? null }, 'home: force legacy pile A (dataSource=legacy)');
  }
  const tables = getSeasonTables(seasonCtx);
  const currentGw = seasonCtx.currentGw;
  const viewingGw = seasonDisplayGw(seasonCtx, query.gw ?? null);

  if (seasonCtx.useSeasonStack) {
    req.log.info(
      {
        seasonId: seasonCtx.seasonId,
        seasonLabel: seasonCtx.seasonLabel,
        currentGw,
        viewingGw,
      },
      'home: season stack active'
    );
  }

  let fixturesQ = (supa as any)
    .from(tables.fixtures)
    .select('*')
    .eq('gw', viewingGw)
    .order('fixture_index', { ascending: true });
  fixturesQ = applySeasonFilter(fixturesQ, seasonCtx);

  let picksQ = (supa as any)
    .from(tables.picks)
    .select('fixture_index, pick')
    .eq('user_id', userId)
    .eq('gw', viewingGw);
  picksQ = applySeasonFilter(picksQ, seasonCtx);

  let resultsQ = (supa as any)
    .from(tables.results)
    .select('fixture_index, result')
    .eq('gw', viewingGw);
  resultsQ = applySeasonFilter(resultsQ, seasonCtx);

  let submissionQ = (supa as any)
    .from(tables.submissions)
    .select('submitted_at')
    .eq('user_id', userId)
    .eq('gw', viewingGw);
  submissionQ = applySeasonFilter(submissionQ, seasonCtx);

  const [
    fixturesRes,
    picksRes,
    liveScoresRes,
    gwResultsRes,
    submissionRes,
  ] = await Promise.all([
    fixturesQ,
    picksQ,
    // live_scores stays legacy-keyed by gw for now; 26/27 won't have live until poll is season-aware
    (supa as any).from('live_scores').select('*').eq('gw', viewingGw),
    resultsQ,
    submissionQ.maybeSingle(),
  ]);

  if (fixturesRes.error) throw fixturesRes.error;
  if (picksRes.error) throw picksRes.error;
  if (liveScoresRes.error) throw liveScoresRes.error;
  if (gwResultsRes.error) throw gwResultsRes.error;
  if (submissionRes.error) throw submissionRes.error;

  const fixtures: HomeSnapshot['fixtures'] = [];
  for (const f of (fixturesRes.data ?? []) as Array<Record<string, unknown>>) {
    const normalized = {
      ...f,
      id: f?.id != null ? String(f.id) : `${viewingGw}-${f?.fixture_index ?? 0}`,
    };
    const parsed = FixtureSchema.safeParse(normalized);
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

  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const tables = getSeasonTables(seasonCtx);

  // Latest completed GW in the user's active pile (season or legacy)
  let latestQ = (supa as any).from(tables.results).select('gw').order('gw', { ascending: false }).limit(1);
  latestQ = applySeasonFilter(latestQ, seasonCtx);
  const { data: latestRes, error: latestErr } = await latestQ.maybeSingle();
  if (latestErr) throw latestErr;
  const latestGw: number | null = (latestRes?.gw as number | null) ?? null;

  // Season rank from the correct OCP view (Pile B is season_id scoped)
  let ocpQ = (supa as any)
    .from(tables.ocpOverall)
    .select('user_id, ocp')
    .order('ocp', { ascending: false })
    .limit(500);
  ocpQ = applySeasonFilter(ocpQ, seasonCtx);
  const { data: ocpRows, error: ocpErr } = await ocpQ;
  if (ocpErr) throw ocpErr;
  const ocpScores = (ocpRows ?? [])
    .map((r: any) => ({ user_id: r.user_id as string, score: Number(r.ocp ?? 0) }))
    .filter((r: any) => r.user_id);
  const season = rankFromSorted(ocpScores, userId);

  // Pre-results (e.g. GW1 open): empty ranks are correct for this season stack
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

  const minGw = Math.max(1, latestGw - 9);
  let gwPointsQ = (supa as any)
    .from(tables.gwPoints)
    .select('user_id, gw, points')
    .gte('gw', minGw)
    .lte('gw', latestGw)
    .order('gw', { ascending: true })
    .limit(20000);
  gwPointsQ = applySeasonFilter(gwPointsQ, seasonCtx);
  const { data: gwPointsRows, error: gwPointsErr } = await gwPointsQ;
  if (gwPointsErr) throw gwPointsErr;

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

  let fixturesCountQ = (supa as any)
    .from(tables.fixtures)
    .select('id', { count: 'exact', head: true })
    .eq('gw', latestGw);
  fixturesCountQ = applySeasonFilter(fixturesCountQ, seasonCtx);
  const { count: latestGwFixtureCount, error: latestGwFxErr } = await fixturesCountQ;
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

const ChatReportBodySchema = z.object({
  messageId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2000),
});

function buildLeagueChatLink(input: { siteUrl?: string; leagueCode?: string | null; messageId: string }) {
  if (!input.siteUrl || !input.leagueCode) return null;
  const base = input.siteUrl.replace(/\/$/, '');
  return `${base}/league/${encodeURIComponent(input.leagueCode)}?tab=chat&messageId=${encodeURIComponent(input.messageId)}`;
}

function buildChatReportEmailText(input: {
  reportId: string;
  reportCreatedAt: string;
  reporterUserId: string;
  reporterEmail?: string | null;
  reporterName?: string | null;
  reportedUserId: string;
  reportedUserName?: string | null;
  leagueId: string;
  leagueName?: string | null;
  leagueCode?: string | null;
  messageId: string;
  messageCreatedAt: string;
  messageContent: string;
  reason: string;
  chatLink: string | null;
}) {
  return [
    'A chat message has been reported in TOTL.',
    '',
    `Report ID: ${input.reportId}`,
    `Reported at: ${input.reportCreatedAt}`,
    '',
    'Reporter',
    `- User ID: ${input.reporterUserId}`,
    `- Name: ${input.reporterName ?? 'Unknown'}`,
    `- Email: ${input.reporterEmail ?? 'Unknown'}`,
    '',
    'Reported message',
    `- Message ID: ${input.messageId}`,
    `- Created at: ${input.messageCreatedAt}`,
    `- Author user ID: ${input.reportedUserId}`,
    `- Author name: ${input.reportedUserName ?? 'Unknown'}`,
    `- Content: ${input.messageContent || '(empty message)'}`,
    '',
    'League',
    `- League ID: ${input.leagueId}`,
    `- League name: ${input.leagueName ?? 'Unknown'}`,
    `- League code: ${input.leagueCode ?? 'Unknown'}`,
    '',
    'Reason',
    input.reason,
    '',
    `Chat link: ${input.chatLink ?? 'Unavailable'}`,
  ].join('\n');
}

function buildHostReviewReadyEmailText(input: {
  hostName?: string | null;
  leaderboardName: string;
  reviewLink: string;
}) {
  return [
    `Hi ${input.hostName?.trim() || 'there'},`,
    '',
    `You've been added as a host for ${input.leaderboardName} on TOTL.`,
    'Your campaign is ready for review.',
    '',
    `Review link: ${input.reviewLink}`,
    '',
    'Thanks,',
    'TOTL',
  ].join('\n');
}

app.post('/v1/chat/reports', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const reporterEmail = ((req as any).userEmail as string | null | undefined) ?? null;
  const body = ChatReportBodySchema.parse((req as any).body);

  const { data: messageData, error: messageError } = await (supa as any)
    .from('league_messages')
    .select('id, league_id, user_id, content, created_at')
    .eq('id', body.messageId)
    .maybeSingle();

  if (messageError) throw messageError;
  if (!messageData) {
    throw Object.assign(new Error('Reported message not found'), { statusCode: 404 });
  }

  const leagueId = String(messageData.league_id);
  const reportedMessageUserId = String(messageData.user_id);

  const [membershipRes, leagueRes, usersRes, reportInsertRes] = await Promise.all([
    (supa as any).from('league_members').select('user_id').eq('league_id', leagueId).eq('user_id', userId).maybeSingle(),
    (supa as any).from('leagues').select('id, name, code').eq('id', leagueId).maybeSingle(),
    (supa as any).from('users').select('id, name').in('id', [userId, reportedMessageUserId]),
    (supa as any)
      .from('league_message_reports')
      .insert({
        reporter_user_id: userId,
        reporter_email: reporterEmail,
        league_id: leagueId,
        message_id: String(messageData.id),
        reason: body.reason,
        reported_message_content: String(messageData.content ?? ''),
        reported_message_user_id: reportedMessageUserId,
        status: 'submitted',
      })
      .select('id, created_at')
      .single(),
  ]);

  if (membershipRes.error) throw membershipRes.error;
  if (!membershipRes.data) {
    throw Object.assign(new Error('You are not allowed to report this message'), { statusCode: 403 });
  }
  if (leagueRes.error) throw leagueRes.error;
  if (usersRes.error) throw usersRes.error;
  if (reportInsertRes.error) throw reportInsertRes.error;

  const namesById = new Map<string, string>();
  for (const row of (usersRes.data ?? []) as Array<{ id: string; name: string | null }>) {
    namesById.set(String(row.id), String(row.name ?? ''));
  }

  const leagueCode = leagueRes.data?.code ? String(leagueRes.data.code) : null;
  const chatLink = buildLeagueChatLink({
    siteUrl: env.SITE_URL,
    leagueCode,
    messageId: String(messageData.id),
  });

  try {
    await sendChatMessageReportEmail({
      env,
      subject: `[TOTL] Chat report ${String(reportInsertRes.data.id)}`,
      text: buildChatReportEmailText({
        reportId: String(reportInsertRes.data.id),
        reportCreatedAt: String(reportInsertRes.data.created_at),
        reporterUserId: userId,
        reporterEmail,
        reporterName: namesById.get(userId) ?? null,
        reportedUserId: reportedMessageUserId,
        reportedUserName: namesById.get(reportedMessageUserId) ?? null,
        leagueId,
        leagueName: leagueRes.data?.name ? String(leagueRes.data.name) : null,
        leagueCode,
        messageId: String(messageData.id),
        messageCreatedAt: String(messageData.created_at),
        messageContent: String(messageData.content ?? ''),
        reason: body.reason,
        chatLink,
      }),
    });
  } catch (error) {
    req.log.error({ err: error, reportId: reportInsertRes.data.id }, 'chat report email failed after report was stored');
    captureException(error);
  }

  return { ok: true };
});

const NotifyHostReviewBodySchema = z.object({
  hostUserId: z.string().uuid(),
});

app.post('/v1/admin/branded-leaderboards/:id/notify-host-review', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const params = z.object({ id: z.string().uuid() }).parse((req as any).params);
  const body = NotifyHostReviewBodySchema.parse((req as any).body);
  const adminSupa = createSupabaseAdminClient(env);

  const { data: adminRow, error: adminError } = await (supa as any)
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (adminError) throw adminError;
  if (!adminRow?.is_admin) {
    throw Object.assign(new Error('Admin access required'), { statusCode: 403 });
  }

  const [leaderboardRes, hostRes, hostAuthRes] = await Promise.all([
    (supa as any)
      .from('branded_leaderboards')
      .select('id, display_name')
      .eq('id', params.id)
      .maybeSingle(),
    (supa as any)
      .from('users')
      .select('id, name')
      .eq('id', body.hostUserId)
      .maybeSingle(),
    adminSupa.auth.admin.getUserById(body.hostUserId),
  ]);

  if (leaderboardRes.error) throw leaderboardRes.error;
  if (!leaderboardRes.data) {
    throw Object.assign(new Error('Leaderboard not found'), { statusCode: 404 });
  }
  if (hostRes.error) throw hostRes.error;
  if (hostAuthRes.error) throw hostAuthRes.error;
  const hostEmail = typeof hostAuthRes.data?.user?.email === 'string' ? hostAuthRes.data.user.email : null;
  if (!hostEmail) {
    throw Object.assign(new Error('Host user not found or has no email'), { statusCode: 404 });
  }

  // Host campaign reviews are web-only. HOST_REVIEW_SITE_URL is deliberately
  // isolated from SITE_URL, which may point at staging for unrelated behavior.
  const reviewLink = buildHostReviewLink(params.id, env.HOST_REVIEW_SITE_URL);

  await sendHostReviewReadyEmail({
    env,
    to: hostEmail,
    subject: `Your TOTL campaign is ready for review: ${String(leaderboardRes.data.display_name)}`,
    text: buildHostReviewReadyEmailText({
      hostName: typeof hostRes.data.name === 'string' ? hostRes.data.name : null,
      leaderboardName: String(leaderboardRes.data.display_name),
      reviewLink,
    }),
  });

  return {
    ok: true,
    email: hostEmail,
    leaderboardId: params.id,
    reviewLink,
  };
});

app.get('/v1/leagues/:leagueId', async (req) => {
  await requireUser(req, supabase);
  const { supa } = getAuthedSupa(req as any);
  const params = LeagueParamsSchema.parse((req as any).params);

  const [leagueRes, membersRes] = await Promise.all([
    (supa as any).from('leagues').select('id, name, code, avatar, created_at').eq('id', params.leagueId).maybeSingle(),
    (supa as any)
      .from('league_members')
      .select('user_id, created_at, users(id, name, avatar_url)')
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
    created_at: typeof m.created_at === 'string' ? m.created_at : null,
  }));

  return { league: leagueRes.data, members };
});

/** Season mini-league table — same numbers as playtotl.com (`League.tsx` season effect). */
app.get('/v1/leagues/:leagueId/season-table', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const params = LeagueParamsSchema.parse((req as any).params);
  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const tables = getSeasonTables(seasonCtx);
  const rows = await computeWebParityMiniLeagueSeasonRows(supa, params.leagueId, null, {
    currentGw: seasonCtx.currentGw,
    seasonId: seasonCtx.useSeasonStack ? seasonCtx.seasonId : null,
    tables: seasonCtx.useSeasonStack
      ? { fixtures: tables.fixtures, picks: tables.picks, results: tables.results }
      : undefined,
  });
  return { rows };
});

/** Returns whether the current user is the league creator (admin). Does not touch the main league endpoint. */
app.get('/v1/leagues/:leagueId/admin', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const params = LeagueParamsSchema.parse((req as any).params);

  let creatorId: string | null = null;

  const leagueRes = await (supa as any)
    .from('leagues')
    .select('created_by')
    .eq('id', params.leagueId)
    .maybeSingle();

  if (!leagueRes.error && leagueRes.data?.created_by) {
    creatorId = leagueRes.data.created_by as string;
  }

  if (!creatorId) {
    const firstMemberRes = await (supa as any)
      .from('league_members')
      .select('user_id')
      .eq('league_id', params.leagueId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstMemberRes.error && firstMemberRes.data?.user_id) {
      creatorId = firstMemberRes.data.user_id as string;
    }
  }

  const isAdmin = !!creatorId && String(creatorId) === String(userId);
  return { isAdmin };
});

const PredictionsQuerySchema = z.object({
  gw: z.coerce.number().int().positive().optional(),
});

app.get('/v1/predictions', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const query = PredictionsQuerySchema.parse((req as any).query);

  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const tables = getSeasonTables(seasonCtx);
  const currentGw = seasonCtx.currentGw;
  const gw = query.gw ?? currentGw;

  let fixturesQ = (supa as any)
    .from(tables.fixtures)
    .select('*')
    .eq('gw', gw)
    .order('fixture_index', { ascending: true });
  fixturesQ = applySeasonFilter(fixturesQ, seasonCtx);

  let picksQ = (supa as any)
    .from(tables.picks)
    .select('fixture_index, pick')
    .eq('user_id', userId)
    .eq('gw', gw);
  picksQ = applySeasonFilter(picksQ, seasonCtx);

  let submissionQ = (supa as any)
    .from(tables.submissions)
    .select('submitted_at')
    .eq('user_id', userId)
    .eq('gw', gw);
  submissionQ = applySeasonFilter(submissionQ, seasonCtx);

  const [fixturesRes, picksRes, submissionRes] = await Promise.all([
    fixturesQ,
    picksQ,
    submissionQ.maybeSingle(),
  ]);

  if (fixturesRes.error) throw fixturesRes.error;
  if (picksRes.error) throw picksRes.error;
  if (submissionRes.error) throw submissionRes.error;

  // Forms: this season only (empty pre-season). Positions: season results once
  // any games are complete; otherwise last-season table snapshot is fine.
  const { teamForms, teamPositions } = await resolveTeamFormsAndPositions(supa as any, seasonCtx, gw);

  return {
    gw,
    fixtures: fixturesRes.data ?? [],
    picks: picksRes.data ?? [],
    submitted: !!submissionRes.data?.submitted_at,
    teamForms,
    teamPositions,
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

  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const tables = getSeasonTables(seasonCtx);

  if (seasonCtx.useSeasonStack && !seasonCtx.seasonId) {
    throw Object.assign(new Error('Season stack enabled but no season_id'), { statusCode: 400 });
  }

  const rows = body.picks.map((p) => ({
    user_id: userId,
    gw: body.gw,
    fixture_index: p.fixture_index,
    pick: p.pick,
    ...(seasonCtx.useSeasonStack && seasonCtx.seasonId
      ? { season_id: seasonCtx.seasonId }
      : {}),
  }));

  const { error } = await (supa as any)
    .from(tables.picks)
    .upsert(rows, { onConflict: tables.picksOnConflict });
  if (error) throw error;
  return { ok: true };
});

const SubmitPredictionsBodySchema = z.object({
  gw: z.number().int().positive(),
});

app.post('/v1/predictions/submit', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const accessToken = (req as any).accessToken as string;
  const body = SubmitPredictionsBodySchema.parse((req as any).body);

  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const tables = getSeasonTables(seasonCtx);

  if (seasonCtx.useSeasonStack && !seasonCtx.seasonId) {
    throw Object.assign(new Error('Season stack enabled but no season_id'), { statusCode: 400 });
  }

  const row = {
    user_id: userId,
    gw: body.gw,
    submitted_at: new Date().toISOString(),
    ...(seasonCtx.useSeasonStack && seasonCtx.seasonId
      ? { season_id: seasonCtx.seasonId }
      : {}),
  };

  const { error } = await (supa as any)
    .from(tables.submissions)
    .upsert(row, { onConflict: tables.submissionsOnConflict });
  if (error) throw error;

  // Submission is canonical before notification checks run. A notification
  // failure must never roll back a user's successful prediction submission.
  try {
    const { data: memberships, error: membershipsError } = await (supa as any)
      .from('league_members')
      .select('league_id')
      .eq('user_id', userId);
    if (membershipsError) throw membershipsError;

    await notifyFinalSubmissionForLeagues({
      siteUrl: env.SITE_URL,
      accessToken,
      leagueIds: (memberships ?? []).map((membership: { league_id: string }) =>
        String(membership.league_id)
      ),
      gw: body.gw,
      seasonId: seasonCtx.useSeasonStack ? seasonCtx.seasonId : null,
    });
  } catch (notificationError) {
    app.log.warn(
      { err: notificationError, userId, gw: body.gw },
      'Final submission notification check failed'
    );
  }

  return { ok: true };
});

app.get('/v1/leaderboards/overall', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);

  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const tables = getSeasonTables(seasonCtx);
  let q = (supa as any)
    .from(tables.ocpOverall)
    .select('user_id, name, ocp')
    .order('ocp', { ascending: false })
    .limit(200);
  q = applySeasonFilter(q, seasonCtx);
  const { data, error } = await q;
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
  /** Service role is preferred for full stats joins, but local dev should not hard-fail when the secret is unavailable. */
  const statsSupa = env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient(env) : supa;
  return getProfileStats({ userId, supa: statsSupa });
});

app.get('/v1/profile/unicorns', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  return { unicorns: await getProfileUnicorns({ userId, supa }) };
});

app.delete('/v1/profile/account', async (req) => {
  await requireUser(req, supabase);
  const { userId } = getAuthedSupa(req as any);
  const adminSupa = createSupabaseAdminClient(env);

  const cleanupTables = [
    'push_subscriptions',
    'expo_push_tokens',
    'chat_presence',
    'league_notification_settings',
    'notification_send_log',
    'email_preferences',
    'user_notification_preferences',
    'league_members',
    'league_messages',
    'league_message_reads',
    'league_message_reactions',
    'branded_leaderboard_hosts',
    'branded_leaderboard_memberships',
    'branded_leaderboard_subscriptions',
    'branded_leaderboard_broadcast_messages',
    'branded_leaderboard_broadcast_reactions',
    'branded_leaderboard_broadcast_reads',
    'app_picks',
    'app_gw_submissions',
    'app_season_picks',
    'app_season_submissions',
    'picks',
    'gw_submissions',
    'test_api_picks',
    'test_api_submissions',
  ];

  for (const table of cleanupTables) {
    const { error } = await (adminSupa as any).from(table).delete().eq('user_id', userId);
    if (error && error.code !== '42P01') {
      throw error;
    }
  }

  const { error: publicUserError } = await (adminSupa as any).from('users').delete().eq('id', userId);
  if (publicUserError) throw publicUserError;

  const { error: authDeleteError } = await adminSupa.auth.admin.deleteUser(userId);
  if (authDeleteError) throw authDeleteError;

  return { ok: true };
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
  const { userId, supa } = getAuthedSupa(req as any);
  const params = z
    .object({ leagueId: z.string().uuid(), gw: z.coerce.number().int().positive() })
    .parse((req as any).params);

  const leagueId = params.leagueId;
  const gw = params.gw;

  // Dual-stack: season-stack testers must read Pile B picks/submissions for this GW,
  // or last season’s GW1 rows light every avatar as “submitted” on 2026/27 GW1.
  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const tables = getSeasonTables(seasonCtx);

  let submissionsQ = (supa as any).from(tables.submissions).select('user_id').eq('gw', gw);
  submissionsQ = applySeasonFilter(submissionsQ, seasonCtx);

  let picksQ = (supa as any)
    .from(tables.picks)
    .select('user_id, fixture_index, pick')
    .eq('gw', gw);
  picksQ = applySeasonFilter(picksQ, seasonCtx);

  let resultsQ = (supa as any).from(tables.results).select('fixture_index, result').eq('gw', gw);
  resultsQ = applySeasonFilter(resultsQ, seasonCtx);

  let fixturesQ = (supa as any)
    .from(tables.fixtures)
    .select('fixture_index, api_match_id')
    .eq('gw', gw);
  fixturesQ = applySeasonFilter(fixturesQ, seasonCtx);

  const [membersRes, submissionsRes, picksRes, liveScoresRes, resultsRes, fixturesRes] = await Promise.all([
    (supa as any)
      .from('league_members')
      .select('user_id, users(id, name, avatar_url)')
      .eq('league_id', leagueId)
      .limit(200),
    submissionsQ,
    picksQ,
    // live_scores still legacy-keyed by gw until poll is season-aware
    (supa as any).from('live_scores').select('api_match_id, fixture_index, home_score, away_score, status').eq('gw', gw),
    resultsQ,
    fixturesQ,
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
  const picks = (picksRes.data ?? []).filter(
    (p: any) => memberIds.has(p.user_id) && (p.pick === 'H' || p.pick === 'D' || p.pick === 'A')
  );
  // Treat either explicit submission rows OR existing picks as evidence of submission.
  const submittedIds = new Set<string>([
    ...((submissionsRes.data ?? []) as any[])
      .map((s: any) => s.user_id as string)
      .filter((id: string) => memberIds.has(id)),
    ...picks.map((p: any) => String(p.user_id)),
  ]);

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

app.get('/v1/leaderboards/gw/:gw/live', async (req) => {
  await requireUser(req, supabase);
  const { userId, supa } = getAuthedSupa(req as any);
  const params = z.object({ gw: z.coerce.number().int().positive() }).parse((req as any).params);
  const gw = params.gw;

  const seasonCtx = await resolveSeasonCtx(supa as any, userId);
  const scoreRows = await computeLiveGwScoresForGw(supa, gw, seasonCtx);

  if (!scoreRows.length) {
    return { gw, rows: [] as Array<{ user_id: string; name: string; score: number }> };
  }

  const submittedIds = scoreRows.map((r) => r.user_id);
  const { data: usersData, error: usersErr } = await (supa as any).from('users').select('id,name').in('id', submittedIds);
  if (usersErr) throw usersErr;

  const scoreByUser = new Map(scoreRows.map((r) => [r.user_id, r.score]));
  const rows: Array<{ user_id: string; name: string; score: number }> = (usersData ?? []).map((u: any) => ({
    user_id: String(u.id),
    name: typeof u.name === 'string' && u.name.trim() ? u.name : 'User',
    score: Number(scoreByUser.get(String(u.id)) ?? 0),
  }));

  rows.sort(
    (a: { user_id: string; name: string; score: number }, b: { user_id: string; name: string; score: number }) =>
      b.score - a.score || a.name.localeCompare(b.name)
  );
  return { gw, rows };
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

registerBrandedLeaderboardRoutes(app, env);

await app.listen({ port: env.PORT, host: '0.0.0.0' });

