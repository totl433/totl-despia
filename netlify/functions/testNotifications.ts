/**
 * Test Notifications Function
 * 
 * Systematically tests all notification types in the catalog.
 * 
 * Usage:
 *   POST /.netlify/functions/testNotifications
 *   Body: { "type": "goal-scored", "userId": "uuid" }  // Test single type
 *   Body: { "type": "all", "userId": "uuid" }          // Test all types
 *   Body: { "type": "dry-run" }                         // Verify catalog only
 * 
 * ⚠️ This will send REAL notifications to the specified user!
 * Use a test user ID for testing.
 */

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { dispatchNotification } from './lib/notifications';
import { getCatalogEntry, getAllCatalogKeys } from './lib/notifications/catalog';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TestResult {
  notification_key: string;
  status: 'success' | 'failed' | 'skipped';
  details: any;
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body, null, 2),
  };
}

// Test data generators for each notification type
const testDataGenerators: Record<string, (userId: string) => any> = {
  'goal-scored': (userId) => ({
    event_id: `test_goal:${Date.now()}`,
    title: '🧪 TEST: Man United scores!',
    body: "52' Marcus Rashford\nMan United [2] - 1 Liverpool",
    data: {
      type: 'goal',
      api_match_id: 99999,
      fixture_index: 1,
      gw: 99,
    },
    grouping_params: { api_match_id: 99999 },
  }),

  'goal-disallowed': (userId) => ({
    event_id: `test_goal_disallowed:${Date.now()}`,
    title: '🧪 TEST: 🚫 Goal Disallowed',
    body: "67' Haaland's goal for Man City was disallowed by VAR\nMan City 1-1 Arsenal",
    data: {
      type: 'goal_disallowed',
      api_match_id: 99998,
      fixture_index: 2,
      gw: 99,
    },
    grouping_params: { api_match_id: 99998 },
  }),

  'kickoff': (userId) => ({
    event_id: `test_kickoff:${Date.now()}:1`,
    title: '🧪 TEST: ⚽ Chelsea vs Tottenham',
    body: 'Kickoff!',
    data: {
      type: 'kickoff',
      api_match_id: 99997,
      fixture_index: 3,
      gw: 99,
    },
    grouping_params: { api_match_id: 99997, half: 1 },
  }),

  'half-time': (userId) => ({
    event_id: `test_halftime:${Date.now()}`,
    title: '🧪 TEST: ⏸️ Half-Time',
    body: 'Newcastle 2-0 Everton 45\'',
    data: {
      type: 'half_time',
      api_match_id: 99996,
      fixture_index: 4,
      gw: 99,
    },
    grouping_params: { api_match_id: 99996 },
    skip_preference_check: true,
  }),

  'final-whistle': (userId) => ({
    event_id: `test_ft:${Date.now()}`,
    title: '🧪 TEST: FT: Brighton 3-2 Wolves',
    body: '✅ Got it right! 42% of players got this fixture correct',
    data: {
      type: 'game_finished',
      api_match_id: 99995,
      fixture_index: 5,
      gw: 99,
    },
    grouping_params: { api_match_id: 99995 },
  }),

  'gameweek-complete': (userId) => ({
    event_id: `test_gw_complete:${Date.now()}`,
    title: '🧪 TEST: 🎉 Gameweek 99 Complete!',
    body: 'All games finished. Check your results!',
    data: {
      type: 'gameweek_finished',
      gw: 99,
    },
    grouping_params: { gw: 99 },
  }),

  'chat-message': (userId) => ({
    event_id: `test_chat:${Date.now()}`,
    title: '🧪 TEST: Test User',
    body: 'This is a test chat notification! 🎉',
    data: {
      type: 'chat_message',
      league_id: 'test-league-123',
      message_id: `msg-${Date.now()}`,
    },
    grouping_params: { league_id: 'test-league-123' },
    league_id: 'test-league-123',
  }),

  'final-submission': (userId) => ({
    event_id: `test_final_sub:${Date.now()}`,
    title: '🧪 TEST: All predictions submitted! 🎉',
    body: 'Everyone in Test League has submitted for GW 99. Check out who picked what!',
    data: {
      type: 'final_submission',
      league_id: 'test-league-123',
      gw: 99,
    },
    grouping_params: { league_id: 'test-league-123', gw: 99 },
  }),

  'new-gameweek': (userId) => ({
    event_id: `test_new_gw:${Date.now()}`,
    title: '🧪 TEST: ⚽ Gameweek 99 is live!',
    body: 'Fixtures are now available. Make your picks before kickoff!',
    data: {
      type: 'new_gameweek',
      gw: 99,
    },
    grouping_params: { gw: 99 },
  }),
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  // Require admin/service role (basic check via secret header)
  const authHeader = event.headers['x-test-secret'] || event.headers['authorization'];
  const expectedSecret = process.env.TEST_NOTIFICATION_SECRET || 'test-secret-change-me';
  
  if (authHeader !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return json(401, { 
      error: 'Unauthorized',
      hint: 'Set x-test-secret header or TEST_NOTIFICATION_SECRET env var',
    });
  }

  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { type, userId } = payload;

  if (!type) {
    return json(400, { 
      error: 'Missing "type" in body',
      available_types: ['all', 'dry-run', ...Object.keys(testDataGenerators)],
    });
  }

  // Dry run - just verify catalog
  if (type === 'dry-run') {
    const catalogKeys = getAllCatalogKeys();
    const results: any[] = [];
    
    for (const key of catalogKeys) {
      const entry = getCatalogEntry(key);
      results.push({
        notification_key: key,
        status: entry ? 'found' : 'missing',
        has_test_generator: !!testDataGenerators[key],
        entry: entry ? {
          owner: entry.owner,
          preference_key: entry.preferences?.preference_key,
          collapse_id_format: entry.onesignal?.collapse_id_format,
        } : null,
      });
    }

    return json(200, {
      mode: 'dry-run',
      catalog_count: catalogKeys.length,
      results,
    });
  }

  // Real test requires userId
  if (!userId) {
    return json(400, { 
      error: 'Missing "userId" in body (required for real tests)',
      hint: 'Use dry-run mode to test catalog without sending notifications',
    });
  }

  // Verify user exists
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userCheck } = await supabase
    .from('push_subscriptions')
    .select('user_id, player_id, is_active, subscribed')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!userCheck) {
    return json(400, {
      error: 'User has no active push subscription',
      userId,
      hint: 'Make sure the user has registered their device in the app',
    });
  }

  const results: TestResult[] = [];

  // Test single type or all
  const typesToTest = type === 'all' 
    ? Object.keys(testDataGenerators)
    : [type];

  for (const notificationType of typesToTest) {
    const generator = testDataGenerators[notificationType];
    
    if (!generator) {
      results.push({
        notification_key: notificationType,
        status: 'skipped',
        details: { reason: 'No test generator defined' },
      });
      continue;
    }

    const catalogEntry = getCatalogEntry(notificationType);
    if (!catalogEntry) {
      results.push({
        notification_key: notificationType,
        status: 'skipped',
        details: { reason: 'Not in catalog' },
      });
      continue;
    }

    try {
      const testData = generator(userId);
      
      console.log(`[testNotifications] Testing ${notificationType} for user ${userId}`);
      
      const result = await dispatchNotification({
        notification_key: notificationType,
        event_id: testData.event_id,
        user_ids: [userId],
        title: testData.title,
        body: testData.body,
        data: testData.data,
        grouping_params: testData.grouping_params,
        skip_preference_check: testData.skip_preference_check,
        league_id: testData.league_id,
      });

      results.push({
        notification_key: notificationType,
        status: result.results.accepted > 0 ? 'success' : 'failed',
        details: {
          accepted: result.results.accepted,
          failed: result.results.failed,
          suppressed_duplicate: result.results.suppressed_duplicate,
          suppressed_preference: result.results.suppressed_preference,
          suppressed_unsubscribed: result.results.suppressed_unsubscribed,
          user_results: result.user_results,
        },
      });

      // Small delay between notifications to avoid overwhelming
      if (type === 'all') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (err: any) {
      results.push({
        notification_key: notificationType,
        status: 'failed',
        details: { error: err.message },
      });
    }
  }

  const summary = {
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
  };

  return json(200, {
    mode: type === 'all' ? 'all-types' : 'single-type',
    userId,
    subscription: {
      player_id: userCheck.player_id?.slice(0, 8) + '...',
      is_active: userCheck.is_active,
      subscribed: userCheck.subscribed,
    },
    summary,
    results,
  });
};

