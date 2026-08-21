import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification } from './lib/notifications';
import { resolveMemberJoinName } from './lib/notifications/memberJoinName';
import { buildLeaguePublicUrl } from './lib/notifications/publicLinks';
import { resolveDualStackRuntime } from './lib/seasonStackPoll';

type LeagueRow = {
  id: string;
  name: string;
  code: string;
  created_at: string | null;
  avatar: string | null;
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function normalizeCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: 'Server configuration is incomplete' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json(401, { error: 'Sign in to use this invite' });

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const userId = authData.user?.id;
  if (authError || !userId) return json(401, { error: 'Your session has expired. Please sign in again.' });

  let payload: Record<string, unknown> = {};
  if (event.httpMethod === 'POST') {
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { error: 'Invalid request body' });
    }
  }
  const code = normalizeCode(event.httpMethod === 'GET' ? event.queryStringParameters?.code : payload.code);
  if (!/^[A-Z0-9]{5}$/.test(code)) return json(400, { error: 'Invalid mini-league invite code' });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: leagueData, error: leagueError } = await admin
    .from('leagues')
    .select('id,name,code,created_at,avatar')
    .eq('code', code)
    .maybeSingle();
  if (leagueError) return json(500, { error: 'Could not open this invite' });
  if (!leagueData?.id) return json(404, { error: 'This invite is invalid or no longer available' });

  const league: LeagueRow = {
    id: String(leagueData.id),
    name: String(leagueData.name ?? 'Mini league'),
    code: String(leagueData.code ?? code),
    created_at: typeof leagueData.created_at === 'string' ? leagueData.created_at : null,
    avatar: typeof leagueData.avatar === 'string' ? leagueData.avatar : null,
  };
  if (event.httpMethod === 'GET') return json(200, { ok: true, league });

  const { data: userMemberships, error: userMembershipsError } = await admin
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId);
  if (userMembershipsError) return json(500, { error: 'Could not check your mini leagues' });
  if ((userMemberships ?? []).some((row) => String(row.league_id) === league.id)) {
    return json(200, { ok: true, league, joined: false, alreadyMember: true });
  }
  if ((userMemberships?.length ?? 0) >= 20) {
    return json(409, { error: "You're already in 20 mini leagues. Leave one before joining another." });
  }

  const { data: members, error: membersError } = await admin
    .from('league_members')
    .select('user_id,created_at')
    .eq('league_id', league.id)
    .order('created_at', { ascending: true });
  if (membersError) return json(500, { error: 'Could not check this mini league' });
  if ((members?.length ?? 0) >= 8) return json(409, { error: 'This mini league is full.' });

  // Count the 4-GW join window against the live season, not last season's GW38.
  // Existing mini-leagues therefore reopen for the first 4 gameweeks of 26/27 (and each season after).
  // If season lookup fails, skip the lock rather than 500 or using GW38.
  try {
    const runtime = await resolveDualStackRuntime(admin);
    const useSeasonStack = typeof runtime.seasonGw === 'number' && !!runtime.seasonId;
    const currentGw = useSeasonStack ? runtime.seasonGw : runtime.legacyGw;
    if (currentGw !== null && (members?.length ?? 0) >= 2) {
      const activationAt =
        (members ?? [])
          .map((row) => row.created_at)
          .filter((value): value is string => typeof value === 'string' && value.length > 10)
          .sort((a, b) => Date.parse(a) - Date.parse(b))[1] ?? league.created_at;

      if (activationAt) {
        let fixturesQuery = admin
          .from(useSeasonStack ? 'app_season_fixtures' : 'app_fixtures')
          .select('gw,kickoff_time')
          .not('kickoff_time', 'is', null)
          .order('gw', { ascending: true })
          .order('kickoff_time', { ascending: true });
        if (useSeasonStack && runtime.seasonId) {
          fixturesQuery = fixturesQuery.eq('season_id', runtime.seasonId);
        }
        const { data: fixtures } = await fixturesQuery;
        const firstKickoffByGw = new Map<number, string>();
        (fixtures ?? []).forEach((fixture) => {
          const gw = Number(fixture.gw);
          if (Number.isFinite(gw) && fixture.kickoff_time && !firstKickoffByGw.has(gw)) {
            firstKickoffByGw.set(gw, String(fixture.kickoff_time));
          }
        });
        let startGw = currentGw;
        for (const [gw, kickoff] of firstKickoffByGw) {
          const deadline = Date.parse(kickoff) - 75 * 60 * 1000;
          if (Date.parse(activationAt) < deadline) {
            startGw = gw;
            break;
          }
        }
        if (currentGw - startGw >= 4) {
          return json(409, {
            error: 'This mini league has been running for more than four gameweeks and is closed to new members.',
          });
        }
      }
    }
  } catch (windowError) {
    console.warn('[joinMiniLeagueByCode] Join window check failed; allowing join:', windowError);
  }

  const { error: joinError } = await admin
    .from('league_members')
    .upsert({ league_id: league.id, user_id: userId }, { onConflict: 'league_id,user_id' });
  if (joinError) return json(500, { error: 'Could not join this mini league' });

  const recipientIds = (members ?? []).map((row) => String(row.user_id)).filter((id) => id && id !== userId);
  if (recipientIds.length > 0) {
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('name')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) {
      console.warn('[joinMiniLeagueByCode] Could not load joiner profile name:', profileError);
    }
    const userName = resolveMemberJoinName({
      profileName: profile?.name,
      authMetadata: authData.user?.user_metadata as Record<string, unknown> | undefined,
      email: authData.user?.email,
    });
    const url = buildLeaguePublicUrl(league.code);
    await dispatchNotification({
      notification_key: 'member-join',
      event_id: `member_join:${league.id}:${userId}`,
      user_ids: recipientIds,
      title: `${userName} Joined!`,
      body: `${userName} joined ${league.name}`,
      data: {
        type: 'member-join',
        leagueId: league.id,
        leagueCode: league.code,
        userId,
        userName,
        leagueName: league.name,
        url,
        navigateTo: url,
      },
      url,
      grouping_params: {
        league_id: league.id,
        user_id: userId,
      },
      league_id: league.id,
    }).catch((error) => {
      console.warn('[joinMiniLeagueByCode] Join succeeded but notification failed:', error);
    });
  }

  return json(200, { ok: true, league, joined: true, alreadyMember: false });
};
