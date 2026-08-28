/**
 * Goal-disallowed confirmation
 *
 * Football Data (and similar feeds) often temporarily retract a goal while VAR
 * reviews it. If the goal stands, the score/goals snap back — but a naive
 * "score went down ⇒ disallowed" push already fired (e.g. Haaland tonight).
 *
 * Flow:
 * 1. Score drop + identifiable removed goal → store a pending candidate (no push)
 * 2. Later poll: goal still missing → send disallowed
 * 3. Later poll: goal back in the list → cancel candidate (false alarm)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnvironment } from './idempotency';

export const GOAL_DISALLOWED_CONFIRM_MS = 90_000; // ~2 poll cycles at 1/min
export const GOAL_DISALLOWED_CANDIDATE_KEY = 'goal-disallowed-candidate';

export type GoalDisallowedCandidate = {
  apiMatchId: number;
  scorer: string;
  minute: number;
  teamName: string;
  fromHome: number;
  fromAway: number;
  toHome: number;
  toAway: number;
  homeTeam: string;
  awayTeam: string;
};

export function buildGoalDisallowedCandidateEventId(
  apiMatchId: number,
  minute: number,
  scorer: string
): string {
  const normalized = (scorer || 'unknown').toString().trim().toLowerCase().replace(/\s+/g, '_');
  return `goal_disallowed_candidate:${apiMatchId}:${minute}:${normalized}`;
}

export function normalizeGoalIdentity(goal: {
  scorer?: string | null;
  minute?: number | null;
}): string {
  const scorer = (goal.scorer || '').toString().trim().toLowerCase();
  const minute =
    goal.minute !== null && goal.minute !== undefined ? String(goal.minute) : '';
  return `${scorer}|${minute}`;
}

export function findRemovedGoals(oldGoals: any[], newGoals: any[]): any[] {
  const newKeys = new Set((newGoals || []).map(normalizeGoalIdentity));
  return (oldGoals || []).filter((g) => {
    const key = normalizeGoalIdentity(g);
    return key !== '|' && !newKeys.has(key);
  });
}

/**
 * Suspicious full wipe of the goals list (API glitch) — do not treat as VAR.
 * A real disallowance removes ~1 goal matching the score delta, not the whole list.
 */
export function isSuspiciousGoalsWipe(
  oldGoals: any[],
  newGoals: any[],
  scoreDrop: number
): boolean {
  const oldCount = (oldGoals || []).length;
  const newCount = (newGoals || []).length;
  if (oldCount <= 1) return false;
  if (newCount > 0) return false;
  // Score only dropped by 1-2 but every goal vanished
  return scoreDrop > 0 && scoreDrop < oldCount;
}

export function goalStillMissing(
  goals: any[],
  candidate: Pick<GoalDisallowedCandidate, 'scorer' | 'minute'>
): boolean {
  const key = normalizeGoalIdentity({
    scorer: candidate.scorer,
    minute: candidate.minute,
  });
  return !(goals || []).some((g) => normalizeGoalIdentity(g) === key);
}

export type CandidateDecision =
  | { action: 'wait' }
  | { action: 'cancel'; reason: string }
  | { action: 'confirm'; reason: string };

export function decideGoalDisallowedCandidate(input: {
  candidateCreatedAt: string | Date;
  nowMs?: number;
  confirmAfterMs?: number;
  goals: any[];
  candidate: Pick<GoalDisallowedCandidate, 'scorer' | 'minute'>;
  scoreWentDownThisUpdate: boolean;
}): CandidateDecision {
  const {
    candidateCreatedAt,
    goals,
    candidate,
    scoreWentDownThisUpdate,
    nowMs = Date.now(),
    confirmAfterMs = GOAL_DISALLOWED_CONFIRM_MS,
  } = input;

  if (!goalStillMissing(goals, candidate)) {
    return { action: 'cancel', reason: 'goal_restored' };
  }

  // Still in the same update that detected the drop — wait for a later poll.
  if (scoreWentDownThisUpdate) {
    return { action: 'wait' };
  }

  const createdAt = new Date(candidateCreatedAt).getTime();
  if (!Number.isFinite(createdAt) || nowMs - createdAt < confirmAfterMs) {
    return { action: 'wait' };
  }

  return { action: 'confirm', reason: 'goal_still_missing_after_confirm_window' };
}

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function recordGoalDisallowedCandidate(
  candidate: GoalDisallowedCandidate
): Promise<{ recorded: boolean; eventId: string }> {
  const supabase = getSupabase();
  const environment = getEnvironment();
  const eventId = buildGoalDisallowedCandidateEventId(
    candidate.apiMatchId,
    candidate.minute,
    candidate.scorer
  );

  const { error } = await supabase.from('notification_send_log').insert({
    environment,
    notification_key: GOAL_DISALLOWED_CANDIDATE_KEY,
    event_id: eventId,
    user_id: null,
    result: 'pending',
    targeting_summary: {},
    payload_summary: candidate,
  });

  if (error) {
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return { recorded: false, eventId };
    }
    console.error('[goalDisallowedConfirm] Failed to record candidate:', error);
    throw error;
  }

  return { recorded: true, eventId };
}

export async function listPendingGoalDisallowedCandidates(
  apiMatchId: number
): Promise<Array<{ id: string; created_at: string; candidate: GoalDisallowedCandidate }>> {
  const supabase = getSupabase();
  const environment = getEnvironment();
  const prefix = `goal_disallowed_candidate:${apiMatchId}:`;

  const { data, error } = await supabase
    .from('notification_send_log')
    .select('id, created_at, payload_summary, event_id')
    .eq('environment', environment)
    .eq('notification_key', GOAL_DISALLOWED_CANDIDATE_KEY)
    .eq('result', 'pending')
    .like('event_id', `${prefix}%`);

  if (error) {
    console.error('[goalDisallowedConfirm] Failed to list candidates:', error);
    return [];
  }

  return (data || [])
    .map((row: any) => ({
      id: row.id as string,
      created_at: row.created_at as string,
      candidate: row.payload_summary as GoalDisallowedCandidate,
    }))
    .filter((row) => row.candidate && row.candidate.apiMatchId === apiMatchId);
}

export async function resolveGoalDisallowedCandidate(
  logId: string,
  result: 'suppressed_duplicate' | 'accepted'
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('notification_send_log')
    .update({ result, updated_at: new Date().toISOString() })
    .eq('id', logId);

  if (error) {
    console.error('[goalDisallowedConfirm] Failed to resolve candidate:', error);
  }
}
