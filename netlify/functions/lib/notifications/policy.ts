/**
 * Policy Module
 * 
 * Enforces notification policies:
 * - User preferences
 * - Cooldowns (per-user, per-notification-type)
 * - Quiet hours
 * - League mutes (for chat notifications)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { NotificationCatalogEntry } from './catalog';
import type { NotificationResult, UserPreferences } from './types';
import { getEnvironment } from './idempotency';

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

export interface PolicyCheckResult {
  allowed: boolean;
  suppression_reason?: NotificationResult;
}

/**
 * Load user notification preferences for a list of users
 */
export async function loadUserPreferences(
  userIds: string[]
): Promise<Map<string, UserPreferences>> {
  const supabase = getSupabase();
  const prefsMap = new Map<string, UserPreferences>();
  
  if (userIds.length === 0) return prefsMap;
  
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('user_id, preferences')
    .in('user_id', userIds);
  
  if (error) {
    console.error('[policy] Error loading user preferences:', error);
    return prefsMap;
  }
  
  for (const row of data || []) {
    prefsMap.set(row.user_id, row.preferences || {});
  }
  
  return prefsMap;
}

/**
 * Check if user has disabled this notification type
 */
export function checkPreference(
  userPrefs: UserPreferences | undefined,
  catalogEntry: NotificationCatalogEntry
): PolicyCheckResult {
  const prefKey = catalogEntry.preferences.preference_key;
  
  // No preference key = always allowed
  if (!prefKey) {
    return { allowed: true };
  }
  
  // No preferences set = use default (usually true)
  if (!userPrefs) {
    return { allowed: catalogEntry.preferences.default };
  }
  
  // Check explicit preference
  const prefValue = userPrefs[prefKey];
  if (prefValue === false) {
    return { allowed: false, suppression_reason: 'suppressed_preference' };
  }
  
  return { allowed: true };
}

/**
 * Check cooldown for a user
 * Returns true if within cooldown period
 */
export async function checkCooldown(
  userId: string,
  notificationKey: string,
  cooldownSeconds: number
): Promise<PolicyCheckResult> {
  if (cooldownSeconds <= 0) {
    return { allowed: true };
  }
  
  const supabase = getSupabase();
  const environment = getEnvironment();
  const cooldownStart = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('notification_send_log')
    .select('id')
    .eq('environment', environment)
    .eq('notification_key', notificationKey)
    .eq('user_id', userId)
    .eq('result', 'accepted')
    .gte('created_at', cooldownStart)
    .limit(1);
  
  if (error) {
    console.error('[policy] Error checking cooldown:', error);
    // On error, allow the notification (fail open)
    return { allowed: true };
  }
  
  if (data && data.length > 0) {
    return { allowed: false, suppression_reason: 'suppressed_cooldown' };
  }
  
  return { allowed: true };
}

/**
 * Check quiet hours
 * TODO: This requires user timezone, which we may not have
 */
export function checkQuietHours(
  catalogEntry: NotificationCatalogEntry
): PolicyCheckResult {
  const { start, end } = catalogEntry.quiet_hours;
  
  // No quiet hours configured
  if (!start || !end) {
    return { allowed: true };
  }
  
  // For now, use server time (UTC)
  // In the future, this should use user's timezone
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  // Parse start/end (format: "HH:MM")
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  
  // Check if current time is in quiet hours
  // Handle overnight quiet hours (e.g., 23:00 to 07:00)
  let inQuietHours = false;
  if (startTime > endTime) {
    // Overnight: quiet from startTime to midnight OR from midnight to endTime
    inQuietHours = currentTime >= startTime || currentTime < endTime;
  } else {
    // Same day: quiet from startTime to endTime
    inQuietHours = currentTime >= startTime && currentTime < endTime;
  }
  
  if (inQuietHours) {
    return { allowed: false, suppression_reason: 'suppressed_quiet_hours' };
  }
  
  return { allowed: true };
}

/**
 * Check if user has muted a specific league (for chat notifications)
 */
export async function checkLeagueMute(
  userId: string,
  leagueId: string | undefined
): Promise<PolicyCheckResult> {
  if (!leagueId) {
    return { allowed: true };
  }
  
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('league_notification_settings')
    .select('muted')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();
  
  if (error) {
    console.error('[policy] Error checking league mute:', error);
    return { allowed: true };
  }
  
  if (data?.muted) {
    return { allowed: false, suppression_reason: 'suppressed_muted' };
  }
  
  return { allowed: true };
}

/**
 * Check rollout percentage
 * Uses deterministic hash of user_id to ensure consistent bucketing
 */
export function checkRollout(
  userId: string,
  catalogEntry: NotificationCatalogEntry
): PolicyCheckResult {
  if (!catalogEntry.rollout.enabled) {
    return { allowed: false, suppression_reason: 'suppressed_rollout' };
  }
  
  if (catalogEntry.rollout.percentage >= 100) {
    return { allowed: true };
  }
  
  // Simple hash function for consistent bucketing
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const bucket = Math.abs(hash) % 100;
  const allowed = bucket < catalogEntry.rollout.percentage;
  
  if (!allowed) {
    return { allowed: false, suppression_reason: 'suppressed_rollout' };
  }
  
  return { allowed: true };
}

/**
 * Run all policy checks for a user
 */
export async function runAllPolicyChecks(
  userId: string,
  catalogEntry: NotificationCatalogEntry,
  userPrefs: UserPreferences | undefined,
  options: {
    skipPreferenceCheck?: boolean;
    skipCooldownCheck?: boolean;
    leagueId?: string;
  } = {}
): Promise<PolicyCheckResult> {
  // 1. Rollout check
  const rolloutResult = checkRollout(userId, catalogEntry);
  if (!rolloutResult.allowed) return rolloutResult;
  
  // 2. Preference check
  if (!options.skipPreferenceCheck) {
    const prefResult = checkPreference(userPrefs, catalogEntry);
    if (!prefResult.allowed) return prefResult;
  }
  
  // 3. Quiet hours check
  const quietResult = checkQuietHours(catalogEntry);
  if (!quietResult.allowed) return quietResult;
  
  // 4. Cooldown check
  if (!options.skipCooldownCheck && catalogEntry.cooldown.per_user_seconds > 0) {
    const cooldownResult = await checkCooldown(
      userId,
      catalogEntry.notification_key,
      catalogEntry.cooldown.per_user_seconds
    );
    if (!cooldownResult.allowed) return cooldownResult;
  }
  
  // 5. League mute check (for chat notifications)
  if (options.leagueId) {
    const muteResult = await checkLeagueMute(userId, options.leagueId);
    if (!muteResult.allowed) return muteResult;
  }
  
  return { allowed: true };
}

