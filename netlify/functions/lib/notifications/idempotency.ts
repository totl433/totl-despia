/**
 * Idempotency Module
 * 
 * Provides insert-first idempotency lock using the notification_send_log table.
 * This ensures only one notification is sent per (env, notification_key, event_id, user_id).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Environment, NotificationResult, SendLogEntry } from './types';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

/**
 * Get the current environment
 */
export function getEnvironment(): Environment {
  // Check for explicit environment variable
  const env = process.env.NOTIFICATION_ENV || process.env.NODE_ENV;
  if (env === 'development' || env === 'dev') return 'dev';
  if (env === 'staging') return 'staging';
  return 'prod';
}

/**
 * Attempt to claim an idempotency lock for a notification
 * 
 * This uses INSERT-first strategy:
 * - If insert succeeds, we have the lock and should send
 * - If insert fails with unique violation, another process already claimed it
 * 
 * @returns Object with `claimed` boolean and `log_id` if claimed
 */
export async function claimIdempotencyLock(
  notificationKey: string,
  eventId: string,
  userId: string | null
): Promise<{ claimed: boolean; log_id?: string; existing_result?: NotificationResult }> {
  const supabase = getSupabase();
  const environment = getEnvironment();
  
  // First, check if entry already exists
  const query = supabase
    .from('notification_send_log')
    .select('id, result')
    .eq('environment', environment)
    .eq('notification_key', notificationKey)
    .eq('event_id', eventId);
  
  if (userId) {
    query.eq('user_id', userId);
  } else {
    query.is('user_id', null);
  }
  
  const { data: existing, error: selectError } = await query.maybeSingle();
  
  if (selectError && !selectError.message.includes('No rows')) {
    console.error('[idempotency] Error checking existing lock:', selectError);
  }
  
  if (existing) {
    // Lock already exists
    return { 
      claimed: false, 
      existing_result: existing.result as NotificationResult 
    };
  }
  
  // Try to insert a placeholder row
  const { data: inserted, error: insertError } = await supabase
    .from('notification_send_log')
    .insert({
      environment,
      notification_key: notificationKey,
      event_id: eventId,
      user_id: userId,
      result: 'pending',
      targeting_summary: {},
      payload_summary: {},
    })
    .select('id')
    .single();
  
  if (insertError) {
    // Check if it's a unique constraint violation
    if (insertError.code === '23505' || insertError.message.includes('duplicate key')) {
      // Another process beat us to it
      return { claimed: false };
    }
    
    // Some other error
    console.error('[idempotency] Error inserting lock:', insertError);
    throw insertError;
  }
  
  return { claimed: true, log_id: inserted.id };
}

/**
 * Update a send log entry with the final result
 */
export async function updateSendLog(
  logId: string,
  update: Partial<SendLogEntry>
): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('notification_send_log')
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId);
  
  if (error) {
    console.error('[idempotency] Error updating send log:', error);
    throw error;
  }
}

/**
 * Create a send log entry directly (for batch operations)
 */
export async function createSendLogEntry(entry: SendLogEntry): Promise<string | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('notification_send_log')
    .insert({
      ...entry,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();
  
  if (error) {
    // Duplicate key = already logged
    if (error.code === '23505' || error.message.includes('duplicate key')) {
      return null;
    }
    console.error('[idempotency] Error creating send log entry:', error);
    throw error;
  }
  
  return data?.id || null;
}

/**
 * Batch claim idempotency locks for multiple users
 * Returns map of userId -> { claimed, log_id }
 */
export async function batchClaimIdempotencyLocks(
  notificationKey: string,
  eventId: string,
  userIds: string[]
): Promise<Map<string, { claimed: boolean; log_id?: string }>> {
  const results = new Map<string, { claimed: boolean; log_id?: string }>();
  
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 50;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (userId) => {
        const result = await claimIdempotencyLock(notificationKey, eventId, userId);
        return { userId, result };
      })
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.userId, result.value.result);
      } else {
        // Failed to claim - treat as not claimed
        console.error('[idempotency] Error claiming lock:', result.reason);
      }
    }
  }
  
  return results;
}

