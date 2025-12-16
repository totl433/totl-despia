/**
 * Notification System Types
 * 
 * Core type definitions for the unified notification dispatcher.
 */

export type NotificationResult = 
  | 'pending'
  | 'accepted'
  | 'failed'
  | 'suppressed_duplicate'
  | 'suppressed_preference'
  | 'suppressed_cooldown'
  | 'suppressed_quiet_hours'
  | 'suppressed_muted'
  | 'suppressed_rollout'
  | 'suppressed_unsubscribed';

export type TargetType = 'external_user_ids' | 'player_ids' | 'segment' | 'filters';

export type Environment = 'prod' | 'dev' | 'staging';

/**
 * Intent to send a notification
 * This is what callers provide to the dispatcher
 */
export interface NotificationIntent {
  /** The notification type key (from catalog) */
  notification_key: string;
  
  /** Deterministic event ID (computed by caller using catalog format) */
  event_id: string;
  
  /** Target user IDs */
  user_ids: string[];
  
  /** Custom title (if not using template) */
  title?: string;
  
  /** Custom body (if not using template) */
  body?: string;
  
  /** Template parameters for title/body interpolation */
  template_params?: Record<string, string | number>;
  
  /** Additional data payload */
  data?: Record<string, any>;
  
  /** Deep link URL */
  url?: string;
  
  /** Parameters for OneSignal grouping field interpolation */
  grouping_params?: Record<string, string | number>;
  
  /** Override: skip preference check */
  skip_preference_check?: boolean;
  
  /** Override: skip cooldown check */
  skip_cooldown_check?: boolean;
  
  /** League ID (for mute checking) */
  league_id?: string;
}

/**
 * Result of dispatching a notification for a single user
 */
export interface DispatchResult {
  user_id: string;
  result: NotificationResult;
  onesignal_notification_id?: string;
  error?: any;
  reason?: string;
}

/**
 * Result of dispatching a notification to multiple users
 */
export interface BatchDispatchResult {
  notification_key: string;
  event_id: string;
  total_users: number;
  results: {
    accepted: number;
    failed: number;
    suppressed_duplicate: number;
    suppressed_preference: number;
    suppressed_cooldown: number;
    suppressed_quiet_hours: number;
    suppressed_muted: number;
    suppressed_unsubscribed: number;
    suppressed_rollout: number;
  };
  user_results: DispatchResult[];
  errors: any[];
}

/**
 * Send log entry (for database)
 */
export interface SendLogEntry {
  environment: Environment;
  notification_key: string;
  event_id: string;
  user_id: string | null;
  external_id?: string | null;
  onesignal_notification_id?: string | null;
  target_type: TargetType | null;
  targeting_summary: Record<string, any>;
  payload_summary: Record<string, any>;
  result: NotificationResult;
  error?: Record<string, any> | null;
}

/**
 * OneSignal notification payload
 */
export interface OneSignalPayload {
  app_id: string;
  headings: { en: string };
  contents: { en: string };
  data?: Record<string, any>;
  url?: string;
  
  // Targeting (one of these)
  include_external_user_ids?: string[];
  include_player_ids?: string[];
  included_segments?: string[];
  filters?: any[];
  
  // Grouping (to prevent duplicate display)
  collapse_id?: string;
  thread_id?: string;
  android_group?: string;
  
  // iOS specific
  ios_badgeType?: string;
  ios_badgeCount?: number;
}

/**
 * User's notification preferences
 */
export interface UserPreferences {
  [key: string]: boolean;
}

/**
 * Push subscription record
 */
export interface PushSubscription {
  user_id: string;
  player_id: string;
  is_active: boolean;
  subscribed: boolean;
  platform?: string;
}

