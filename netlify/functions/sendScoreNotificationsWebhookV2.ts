/**
 * Score Notifications Webhook (V2 - using unified dispatcher)
 * 
 * Migrated from sendScoreNotificationsWebhook.ts to use the new notification system.
 * 
 * Major Changes:
 * - Uses dispatchNotification() instead of direct OneSignal API calls
 * - Idempotency via notification_send_log (replaces notification_state for dedup)
 * - Deterministic event_ids for each notification type
 * - collapse_id/thread_id/android_group set automatically
 * - Per-user sends (not per-pick loops) - prevents multi-device duplicates
 * - Clean separation of concerns via scoreHelpers
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  sendGoalNotification,
  sendGoalDisallowedNotification,
  sendKickoffNotification,
  sendHalftimeNotification,
  sendFinalWhistleNotification,
  sendGameweekCompleteNotification,
} from './lib/notifications/scoreHelpers';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface FixtureInfo {
  fixture_index: number;
  gw: number;
  home_team: string;
  away_team: string;
  isTestFixture: boolean;
  isAppFixture: boolean;
  testGwForPicks: number | null;
}

interface LiveScoreRecord {
  api_match_id: number;
  home_score: number;
  away_score: number;
  status: string;
  minute: number | null;
  goals: any[];
  red_cards: any[];
}

/**
 * Fetch fixture info for a match
 */
async function fetchFixtureInfo(apiMatchId: number): Promise<FixtureInfo | null> {
  const [regularFixture, testFixture, appFixture] = await Promise.all([
    supabase.from('fixtures').select('fixture_index, gw, home_team, away_team').eq('api_match_id', apiMatchId).maybeSingle(),
    supabase.from('test_api_fixtures').select('fixture_index, test_gw, home_team, away_team').eq('api_match_id', apiMatchId).maybeSingle(),
    supabase.from('app_fixtures').select('fixture_index, gw, home_team, away_team').eq('api_match_id', apiMatchId).maybeSingle(),
  ]);

  const fixture = regularFixture.data || testFixture.data || appFixture.data;
  if (!fixture) return null;

  const isTestFixture = !!testFixture.data;
  const isAppFixture = !!appFixture.data;
  const fixtureGw = (fixture as any).gw || (fixture as any).test_gw || 1;
  const testGwForPicks = (fixture as any).test_gw || (isTestFixture ? 1 : null);

  return {
    fixture_index: fixture.fixture_index,
    gw: fixtureGw,
    home_team: fixture.home_team,
    away_team: fixture.away_team,
    isTestFixture,
    isAppFixture,
    testGwForPicks,
  };
}

/**
 * Fetch user IDs who have picks for a fixture
 */
async function fetchUserIdsWithPicks(
  gw: number,
  fixtureIndex: number,
  isAppFixture: boolean,
  isTestFixture: boolean,
  testGwForPicks: number | null,
  includePick: boolean = false
): Promise<{ userId: string; pick?: string }[]> {
  const selectFields = includePick ? 'user_id, pick' : 'user_id';
  
  let data: any[] = [];
  
  if (isAppFixture) {
    const result = await supabase.from('app_picks').select(selectFields).eq('gw', gw).eq('fixture_index', fixtureIndex);
    data = result.data || [];
  } else if (isTestFixture && testGwForPicks) {
    const result = await supabase.from('test_api_picks').select(selectFields).eq('matchday', testGwForPicks).eq('fixture_index', fixtureIndex);
    data = result.data || [];
  } else {
    const result = await supabase.from('picks').select(selectFields).eq('gw', gw).eq('fixture_index', fixtureIndex);
    data = result.data || [];
  }
  
  return data.map((p: any) => ({ userId: p.user_id, pick: p.pick }));
}

/**
 * Determine which team scored from goal object
 */
function determineScoringTeam(
  goal: any,
  homeTeam: string,
  awayTeam: string
): { isHomeTeam: boolean; teamName: string } {
  const scoringTeam = (goal.team || '').toLowerCase().trim();
  const normalizedHome = homeTeam.toLowerCase().trim();
  const normalizedAway = awayTeam.toLowerCase().trim();

  const isHomeTeam = 
    scoringTeam === normalizedHome ||
    scoringTeam.includes(normalizedHome) ||
    normalizedHome.includes(scoringTeam);

  return {
    isHomeTeam,
    teamName: isHomeTeam ? homeTeam : awayTeam,
  };
}

/**
 * Parse webhook payload (handles multiple Supabase formats)
 */
function parseWebhookPayload(body: string): { record: LiveScoreRecord | null; oldRecord: any | null } {
  const payload = JSON.parse(body || '{}');
  
  let record: any = null;
  let oldRecord: any = null;

  if (payload.record && payload.table) {
    record = payload.record;
    oldRecord = payload.old_record;
  } else if (payload.new) {
    record = payload.new;
    oldRecord = payload.old;
  } else if (payload.api_match_id) {
    record = payload;
    oldRecord = {};
  }

  return { record, oldRecord };
}

export const handler: Handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const requestId = Math.random().toString(36).substring(7);
    const { record, oldRecord } = parseWebhookPayload(event.body || '{}');

    if (!record || !record.api_match_id) {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Invalid payload' }) };
    }

    const apiMatchId = record.api_match_id;
    const homeScore = record.home_score ?? 0;
    const awayScore = record.away_score ?? 0;
    const status = record.status;
    const minute = record.minute;
    const goals = record.goals || [];

    const oldHomeScore = oldRecord?.home_score ?? 0;
    const oldAwayScore = oldRecord?.away_score ?? 0;
    const oldStatus = oldRecord?.status;
    const oldGoals = oldRecord?.goals || [];

    console.log(`[scoreWebhookV2] [${requestId}] Processing match ${apiMatchId}: status=${status}, score=${homeScore}-${awayScore}`);

    // Fetch fixture info
    const fixture = await fetchFixtureInfo(apiMatchId);
    if (!fixture) {
      console.log(`[scoreWebhookV2] [${requestId}] No fixture found for api_match_id ${apiMatchId}`);
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No fixture found' }) };
    }

    const { fixture_index, gw, home_team, away_team, isAppFixture, isTestFixture, testGwForPicks } = fixture;

    // Detect changes
    const scoreWentDown = homeScore < oldHomeScore || awayScore < oldAwayScore;
    const isHalfTime = oldStatus === 'IN_PLAY' && status === 'PAUSED';
    const isFinished = status === 'FINISHED' || status === 'FT';
    const isFirstHalfKickoff = status === 'IN_PLAY' && homeScore === 0 && awayScore === 0;
    const isSecondHalfKickoff = (oldStatus === 'PAUSED' || oldStatus === 'HALF_TIME') && status === 'IN_PLAY';

    let totalSent = 0;

    // 1. Handle goal disallowed (score went down)
    if (scoreWentDown) {
      const picksData = await fetchUserIdsWithPicks(gw, fixture_index, isAppFixture, isTestFixture, testGwForPicks);
      const userIds = [...new Set(picksData.map(p => p.userId))];

      if (userIds.length > 0) {
        const result = await sendGoalDisallowedNotification(userIds, {
          apiMatchId, fixtureIndex: fixture_index, gw,
          scorer: 'Unknown', minute: minute || 0,
          teamName: homeScore < oldHomeScore ? home_team : away_team,
          homeTeam: home_team, awayTeam: away_team,
          homeScore, awayScore,
        });
        totalSent += result.results.accepted;
        console.log(`[scoreWebhookV2] [${requestId}] Goal disallowed: ${result.results.accepted} sent`);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Goal disallowed notification sent', sentTo: totalSent }) };
    }

    // 2. Handle new goals
    if (Array.isArray(goals) && goals.length > 0 && !scoreWentDown) {
      // Find new goals by comparing to old goals
      const normalizeGoalKey = (g: any): string => {
        if (!g || typeof g !== 'object') return '';
        const scorer = (g.scorer || '').toString().trim().toLowerCase();
        const minute = g.minute !== null && g.minute !== undefined ? String(g.minute) : '';
        return `${scorer}|${minute}`;
      };

      const oldGoalKeys = new Set(oldGoals.map(normalizeGoalKey));
      const newGoals = goals.filter((g: any) => !oldGoalKeys.has(normalizeGoalKey(g)));

      if (newGoals.length > 0) {
        const picksData = await fetchUserIdsWithPicks(gw, fixture_index, isAppFixture, isTestFixture, testGwForPicks);
        const userIds = [...new Set(picksData.map(p => p.userId))];

        if (userIds.length > 0) {
          // Send notification for the newest goal
          const newestGoal = newGoals.sort((a: any, b: any) => (b.minute ?? 0) - (a.minute ?? 0))[0];
          const scorer = newestGoal.scorer || 'Unknown';
          const goalMinute = newestGoal.minute ?? 0;
          const { isHomeTeam, teamName } = determineScoringTeam(newestGoal, home_team, away_team);

          const result = await sendGoalNotification(userIds, {
            apiMatchId, fixtureIndex: fixture_index, gw,
            scorer, minute: goalMinute, teamName,
            homeTeam: home_team, awayTeam: away_team,
            homeScore, awayScore, isHomeTeam,
            isOwnGoal: newestGoal.isOwnGoal === true,
          });
          totalSent += result.results.accepted;
          console.log(`[scoreWebhookV2] [${requestId}] Goal: ${result.results.accepted} sent`);
        }
      }
    }

    // 3. Handle kickoff
    if (isFirstHalfKickoff || isSecondHalfKickoff) {
      const picksData = await fetchUserIdsWithPicks(gw, fixture_index, isAppFixture, isTestFixture, testGwForPicks);
      const userIds = [...new Set(picksData.map(p => p.userId))];

      if (userIds.length > 0) {
        const result = await sendKickoffNotification(userIds, {
          apiMatchId, fixtureIndex: fixture_index, gw,
          homeTeam: home_team, awayTeam: away_team,
          isSecondHalf: isSecondHalfKickoff,
        });
        totalSent += result.results.accepted;
        console.log(`[scoreWebhookV2] [${requestId}] Kickoff: ${result.results.accepted} sent`);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Kickoff notification sent', sentTo: totalSent }) };
    }

    // 4. Handle half-time
    if (isHalfTime) {
      const picksData = await fetchUserIdsWithPicks(gw, fixture_index, isAppFixture, isTestFixture, testGwForPicks);
      const userIds = [...new Set(picksData.map(p => p.userId))];

      if (userIds.length > 0) {
        const result = await sendHalftimeNotification(userIds, {
          apiMatchId, fixtureIndex: fixture_index, gw,
          homeTeam: home_team, awayTeam: away_team,
          homeScore, awayScore, minute: minute ?? undefined,
        });
        totalSent += result.results.accepted;
        console.log(`[scoreWebhookV2] [${requestId}] Half-time: ${result.results.accepted} sent`);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Half-time notification sent', sentTo: totalSent }) };
    }

    // 5. Handle game finished
    if (isFinished && oldStatus !== 'FINISHED' && oldStatus !== 'FT') {
      const picksData = await fetchUserIdsWithPicks(gw, fixture_index, isAppFixture, isTestFixture, testGwForPicks, true);
      const userIds = [...new Set(picksData.map(p => p.userId))];

      if (userIds.length > 0) {
        // Calculate correct percentage
        let matchResult: string;
        if (homeScore > awayScore) matchResult = 'H';
        else if (awayScore > homeScore) matchResult = 'A';
        else matchResult = 'D';

        const correctCount = picksData.filter(p => p.pick === matchResult).length;
        const correctPercentage = picksData.length > 0 ? Math.round((correctCount / picksData.length) * 100) : 0;

        // Build user picks map
        const userPicks = new Map<string, string>();
        for (const p of picksData) {
          if (p.pick) userPicks.set(p.userId, p.pick);
        }

        const { summary } = await sendFinalWhistleNotification(userIds, {
          apiMatchId, fixtureIndex: fixture_index, gw,
          homeTeam: home_team, awayTeam: away_team,
          homeScore, awayScore, userPicks, correctPercentage,
        });
        totalSent += summary.accepted;
        console.log(`[scoreWebhookV2] [${requestId}] Final whistle: ${summary.accepted} sent`);
      }

      // 6. Check if all games in GW are finished
      const { data: allFixtures } = await supabase
        .from('app_fixtures')
        .select('api_match_id')
        .eq('gw', gw)
        .not('api_match_id', 'is', null);

      if (allFixtures && allFixtures.length > 0) {
        const apiMatchIds = allFixtures.map((f: any) => f.api_match_id);
        const { data: liveScores } = await supabase
          .from('live_scores')
          .select('api_match_id, status')
          .in('api_match_id', apiMatchIds);

        const finishedCount = (liveScores || []).filter((s: any) => s.status === 'FINISHED' || s.status === 'FT').length;

        if (finishedCount === apiMatchIds.length) {
          console.log(`[scoreWebhookV2] [${requestId}] All ${apiMatchIds.length} games finished for GW ${gw}`);

          // Get all users with picks in this GW
          let gwPicks: any[] = [];
          if (isAppFixture) {
            const { data } = await supabase.from('app_picks').select('user_id').eq('gw', gw);
            gwPicks = data || [];
          }

          const gwUserIds = [...new Set(gwPicks.map((p: any) => p.user_id))];

          if (gwUserIds.length > 0) {
            const result = await sendGameweekCompleteNotification(gwUserIds, gw);
            console.log(`[scoreWebhookV2] [${requestId}] Gameweek complete: ${result.results.accepted} sent`);
          }
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Final whistle notification sent', sentTo: totalSent }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ message: 'No notification needed', sentTo: totalSent }) };

  } catch (error: any) {
    console.error('[scoreWebhookV2] Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error?.message }) };
  }
};

