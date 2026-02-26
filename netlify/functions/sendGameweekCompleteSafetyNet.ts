import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { claimIdempotencyLock } from './lib/notifications/idempotency';
import { sendGameweekCompleteNotification } from './lib/notifications/scoreHelpers';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isFinishedStatus(status: unknown): boolean {
  return status === 'FINISHED' || status === 'FT';
}

/**
 * Safety net for `gameweek-complete`.
 *
 * If the webhook path misses the final transition (missing old_record, missing live_scores row, etc),
 * this scheduled function will detect completed gameweeks and send `gameweek-complete` exactly once
 * per GW (global lock) with per-user idempotency inside the dispatcher.
 */
export const handler: Handler = async () => {
  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data: meta } = await admin
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();

    const currentGw = Number((meta as any)?.current_gw || 1);
    const candidates = Array.from(new Set([currentGw, currentGw - 1].filter(gw => gw >= 1)));

    const checks: any[] = [];

    for (const gw of candidates) {
      // Load fixtures for this GW
      const { data: fixtures, error: fixturesError } = await admin
        .from('app_fixtures')
        .select('api_match_id')
        .eq('gw', gw)
        .not('api_match_id', 'is', null);

      if (fixturesError) {
        checks.push({ gw, ok: false, error: 'Failed to load app_fixtures', details: fixturesError.message });
        continue;
      }

      const apiMatchIds = (fixtures || []).map((f: any) => f.api_match_id).filter((id: any) => typeof id === 'number');
      if (apiMatchIds.length === 0) {
        checks.push({ gw, ok: true, skipped: true, reason: 'No fixtures with api_match_id' });
        continue;
      }

      // Load live scores for these fixtures
      const { data: liveScores, error: liveError } = await admin
        .from('live_scores')
        .select('api_match_id,status')
        .in('api_match_id', apiMatchIds);

      if (liveError) {
        checks.push({ gw, ok: false, error: 'Failed to load live_scores', details: liveError.message });
        continue;
      }

      const liveById = new Map<number, string>((liveScores || []).map((s: any) => [s.api_match_id, s.status]));
      const missing = apiMatchIds.filter(id => !liveById.has(id));
      const finishedCount = apiMatchIds.filter(id => isFinishedStatus(liveById.get(id))).length;

      const allFinished = missing.length === 0 && finishedCount === apiMatchIds.length;
      if (!allFinished) {
        checks.push({
          gw,
          ok: true,
          skipped: true,
          reason: 'Not all fixtures finished',
          total: apiMatchIds.length,
          finished: finishedCount,
          missing: missing.length,
        });
        continue;
      }

      const eventId = `gw_complete:${gw}`;

      // Global lock: only attempt once per GW (prevents repeated heavy sends)
      const globalLock = await claimIdempotencyLock('gameweek-complete', eventId, null);
      if (!globalLock.claimed) {
        checks.push({
          gw,
          ok: true,
          skipped: true,
          reason: 'Already sent (global lock exists)',
          event_id: eventId,
          existing_result: globalLock.existing_result,
        });
        continue;
      }

      const { data: picks, error: picksError } = await admin
        .from('app_picks')
        .select('user_id')
        .eq('gw', gw);

      if (picksError) {
        checks.push({ gw, ok: false, error: 'Failed to load app_picks', details: picksError.message });
        continue;
      }

      const userIds = Array.from(new Set((picks || []).map((p: any) => p.user_id).filter(Boolean)));
      if (userIds.length === 0) {
        checks.push({ gw, ok: true, skipped: true, reason: 'No users with picks in GW', event_id: eventId });
        continue;
      }

      const sendResult = await sendGameweekCompleteNotification(userIds, gw);
      checks.push({
        gw,
        ok: true,
        sent: true,
        event_id: eventId,
        users: userIds.length,
        results: sendResult.results,
      });
    }

    return json(200, { ok: true, currentGw, candidates, checks });
  } catch (e: any) {
    return json(500, { error: e?.message || 'Internal error' });
  }
};

