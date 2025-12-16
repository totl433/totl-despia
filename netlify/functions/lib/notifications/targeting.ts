/**
 * Targeting Module
 * 
 * Resolves OneSignal targets for notification recipients.
 * Supports external_user_id targeting (preferred) and player_id fallback.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PushSubscription } from './types';

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
 * Result of resolving targets for a list of users
 */
export interface TargetingResult {
  /** Users with valid targets */
  targetable_users: string[];
  
  /** Users without any valid targets */
  untargetable_users: string[];
  
  /** Map of userId -> player_id(s) */
  player_ids_by_user: Map<string, string[]>;
  
  /** All unique player IDs (for batched sends) */
  all_player_ids: string[];
  
  /** Player ID to user ID mapping (for response correlation) */
  player_id_to_user: Map<string, string>;
}

/**
 * Load push subscriptions for a list of users
 */
export async function loadPushSubscriptions(
  userIds: string[]
): Promise<PushSubscription[]> {
  if (userIds.length === 0) return [];
  
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, player_id, is_active, subscribed, platform')
    .in('user_id', userIds)
    .eq('is_active', true);
  
  if (error) {
    console.error('[targeting] Error loading push subscriptions:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Resolve OneSignal targets for a list of users
 * 
 * Strategy:
 * 1. Load all push subscriptions for the users
 * 2. Filter to active, subscribed devices
 * 3. Return player_ids (we use player_id targeting with Despia's legacy SDK)
 */
export async function resolveTargets(userIds: string[]): Promise<TargetingResult> {
  const result: TargetingResult = {
    targetable_users: [],
    untargetable_users: [],
    player_ids_by_user: new Map(),
    all_player_ids: [],
    player_id_to_user: new Map(),
  };
  
  if (userIds.length === 0) return result;
  
  const subscriptions = await loadPushSubscriptions(userIds);
  
  // Group by user
  for (const sub of subscriptions) {
    if (!sub.player_id) continue;
    
    // Only include subscribed devices
    // Note: We do additional OneSignal verification before sending
    if (!sub.subscribed) continue;
    
    if (!result.player_ids_by_user.has(sub.user_id)) {
      result.player_ids_by_user.set(sub.user_id, []);
    }
    result.player_ids_by_user.get(sub.user_id)!.push(sub.player_id);
    result.all_player_ids.push(sub.player_id);
    result.player_id_to_user.set(sub.player_id, sub.user_id);
  }
  
  // Categorize users
  for (const userId of userIds) {
    const playerIds = result.player_ids_by_user.get(userId) || [];
    if (playerIds.length > 0) {
      result.targetable_users.push(userId);
    } else {
      result.untargetable_users.push(userId);
    }
  }
  
  // Dedupe player IDs
  result.all_player_ids = Array.from(new Set(result.all_player_ids));
  
  return result;
}

/**
 * Verify subscription status with OneSignal and update DB
 * Returns only the player IDs that are actually subscribed
 */
export async function verifyAndFilterSubscriptions(
  playerIds: string[]
): Promise<{
  subscribed: string[];
  unsubscribed: string[];
}> {
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
  
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn('[targeting] OneSignal credentials not configured');
    return { subscribed: playerIds, unsubscribed: [] };
  }
  
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  const supabase = getSupabase();
  
  // Check each player ID with OneSignal
  // TODO: OneSignal v5 API supports batch player lookup - migrate when possible
  const checks = await Promise.allSettled(
    playerIds.map(async (playerId) => {
      try {
        const response = await fetch(
          `https://onesignal.com/api/v1/players/${playerId}?app_id=${ONESIGNAL_APP_ID}`,
          {
            headers: {
              'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
          }
        );
        
        if (!response.ok) {
          return { playerId, isSubscribed: false };
        }
        
        const player = await response.json();
        const hasToken = !!player.identifier;
        const notInvalid = !player.invalid_identifier;
        const notificationTypes = player.notification_types;
        
        // OneSignal subscription logic
        const explicitlySubscribed = notificationTypes === 1;
        const explicitlyUnsubscribed = notificationTypes === -2 || notificationTypes === 0;
        const stillInitializing = 
          (notificationTypes === null || notificationTypes === undefined) && 
          hasToken && notInvalid;
        
        const isSubscribed = explicitlySubscribed || (stillInitializing && !explicitlyUnsubscribed);
        
        // Update DB with current status
        await supabase
          .from('push_subscriptions')
          .update({
            subscribed: isSubscribed,
            last_checked_at: new Date().toISOString(),
            invalid: !!player.invalid_identifier,
          })
          .eq('player_id', playerId);
        
        return { playerId, isSubscribed };
      } catch (err) {
        console.error(`[targeting] Error checking player ${playerId}:`, err);
        return { playerId, isSubscribed: false };
      }
    })
  );
  
  for (const check of checks) {
    if (check.status === 'fulfilled') {
      if (check.value.isSubscribed) {
        subscribed.push(check.value.playerId);
      } else {
        unsubscribed.push(check.value.playerId);
      }
    }
  }
  
  return { subscribed, unsubscribed };
}

/**
 * Get a single player ID per user (to avoid duplicates)
 * Prefers most recently active device
 */
export async function getSinglePlayerIdPerUser(
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  
  const supabase = getSupabase();
  
  // Get the most recently active device per user
  // Using a subquery approach since Supabase doesn't support DISTINCT ON
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, player_id, updated_at')
    .in('user_id', userIds)
    .eq('is_active', true)
    .eq('subscribed', true)
    .order('updated_at', { ascending: false });
  
  if (error) {
    console.error('[targeting] Error getting single player per user:', error);
    return new Map();
  }
  
  // Take first (most recent) player_id per user
  const result = new Map<string, string>();
  for (const row of data || []) {
    if (!result.has(row.user_id) && row.player_id) {
      result.set(row.user_id, row.player_id);
    }
  }
  
  return result;
}

