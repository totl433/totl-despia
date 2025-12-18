/**
 * Email preferences utilities
 * Helper functions for checking email preferences before sending emails
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export type EmailPreferenceType = 'new-gameweek' | 'results-published' | 'news-updates';

/**
 * Check if a user should receive a specific email type
 * Returns true only if user has explicitly opted in (preference = true)
 * Returns false if preference is false or no preference exists (opted out by default)
 */
export async function shouldSendEmail(
  userId: string,
  emailType: EmailPreferenceType
): Promise<boolean> {
  const columnMap: Record<EmailPreferenceType, string> = {
    'new-gameweek': 'new_gameweek',
    'results-published': 'results_published',
    'news-updates': 'news_updates',
  };

  const columnName = columnMap[emailType];
  if (!columnName) {
    console.error(`[emailPreferences] Unknown email type: ${emailType}`);
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('email_preferences')
      .select(columnName)
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error(`[emailPreferences] Error checking preference for user ${userId}:`, error);
      return false;
    }

    // Only return true if explicitly set to true
    // Missing row or false means opted out (don't send)
    return data?.[columnName] === true;
  } catch (error) {
    console.error(`[emailPreferences] Exception checking preference for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get all users who should receive a specific email type
 * Returns array of user IDs who have opted in
 */
export async function getUsersForEmailType(
  emailType: EmailPreferenceType
): Promise<string[]> {
  const columnMap: Record<EmailPreferenceType, string> = {
    'new-gameweek': 'new_gameweek',
    'results-published': 'results_published',
    'news-updates': 'news_updates',
  };

  const columnName = columnMap[emailType];
  if (!columnName) {
    console.error(`[emailPreferences] Unknown email type: ${emailType}`);
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('email_preferences')
      .select('user_id')
      .eq(columnName, true);

    if (error) {
      console.error(`[emailPreferences] Error fetching users for ${emailType}:`, error);
      return [];
    }

    return (data || []).map((row: any) => row.user_id);
  } catch (error) {
    console.error(`[emailPreferences] Exception fetching users for ${emailType}:`, error);
    return [];
  }
}

/**
 * Get user email addresses who should receive a specific email type
 * Returns array of email addresses
 */
export async function getEmailsForEmailType(
  emailType: EmailPreferenceType
): Promise<string[]> {
  const userIds = await getUsersForEmailType(emailType);
  if (userIds.length === 0) {
    return [];
  }

  try {
    // Get user emails from auth.users
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('[emailPreferences] Error fetching users:', error);
      return [];
    }

    const emailMap = new Map<string, string>();
    users?.users?.forEach((user: any) => {
      if (user.email) {
        emailMap.set(user.id, user.email);
      }
    });

    // Return emails for users who have the preference enabled
    return userIds
      .map((userId) => emailMap.get(userId))
      .filter((email): email is string => !!email);
  } catch (error) {
    console.error('[emailPreferences] Exception fetching emails:', error);
    return [];
  }
}

