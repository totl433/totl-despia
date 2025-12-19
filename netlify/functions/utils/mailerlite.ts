/**
 * MailerLite API utilities
 * Handles syncing user email preferences with MailerLite
 */

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api';
const MAILERLITE_API_VERSION = '2024-01-01';

interface MailerLiteSubscriber {
  email: string;
  status?: 'active' | 'unsubscribed' | 'bounced' | 'junk';
  groups?: string[];
  fields?: Record<string, any>;
}

interface MailerLiteGroup {
  id: string;
  name: string;
}

/**
 * Get MailerLite API key from environment
 */
function getApiKey(): string {
  // Try environment variable first
  let key = process.env.MAILERLITE_API_KEY?.trim();
  
  // TEMPORARY FALLBACK: If env var not available, use hardcoded key
  // This is a workaround for Netlify Functions env var propagation issues
  // TODO: Remove this once env var propagation is fixed
  if (!key) {
    console.warn('[mailerlite] MAILERLITE_API_KEY not found in env, using fallback');
    key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiOTUyNjM3MTlmMmU0NGI1Zjk4MmRlNTNkY2MzNDIwYjY4NGFmMmNiOTY5ODFkZDExNDczNmI4YzhkZTc5OTQ1NWRjMDM1MThjYWZiOWQ2MTQiLCJpYXQiOjE3NjYwOTY5MTUuODIxODUyLCJuYmYiOjE3NjYwOTY5MTUuODIxODU0LCJleHAiOjQ5MjE3NzA1MTUuODE0MTcsInN1YiI6IjE4ODc2NDYiLCJzY29wZXMiOltdfQ.m7rbK7DngeoyzWpe1q4bx7UZ7_ncVTUI80JlIIxmwRM33o3mAaB52TfP1LPhRsQoolH2PRo788Pd8HIxrQJQFySfScEK56S5hX53H7LUXvVN8GG8KBjJZvBifjN8FAtMaOzw-v8QZcWVuQFAjhQrV_wq3k7QfBptVww53pwpebiCn9EZvAGCijXIUsLyz7JcDS8HmA44vzKd4DBjo6fPSKV65MqJkhT6VUYIp3NKdemDvICXLSfx2InGvL0Kn1QBYtVPNYpT_qV809ebEAJuswQq3m0INgjPkbzD4oLmhWw-YLB04QkbmaYW2izgE4zIflPAjKJNLuy4IarBfYj-lyD1N1naOCzsN1BR6peUYTe4FnGC8xtDaD8RN1Ab0sEG-U8WqmKyrl7NHFZMhtManu3aOaoSSDEWYSt-dHQSw3IbVX_pMktSKPfX4F3GFmd-eTQBDX_To4YpiikM8sIttSS_d26F-T3Io84gsQPJhzK9oztcqBKT_jrTnkQlfK8-PnCrf8uJztS_pz7MJKEIP9fh7lTygyo-yvjcbgEUPqkNgyXlbmjb2me8lCMbC7_FvhMGjxq6p7gGjojE3XBV-I5kG1EZOjga_BOENWsA65XZbgor6vaGrUxyL8zSgm6bXVJc0SKkFzHqlyXJS4WzZU-ppOruNWlRTwnwmlq8f90'.trim();
  }
  
  if (!key) {
    throw new Error('MAILERLITE_API_KEY environment variable is not set and no fallback available');
  }
  return key;
}

/**
 * Make authenticated request to MailerLite API
 */
async function mailerLiteRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const apiKey = getApiKey();
  const url = `${MAILERLITE_API_BASE}/${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-Version': MAILERLITE_API_VERSION,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      throw new Error(`MailerLite API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    // Some endpoints return empty body
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    return null;
  } catch (error: any) {
    if (error.message.includes('MailerLite API error')) {
      throw error;
    }
    throw new Error(`MailerLite API request failed: ${error.message}`);
  }
}

/**
 * Get all groups from MailerLite
 * Groups are used to segment subscribers by email preference type
 */
export async function getGroups(): Promise<MailerLiteGroup[]> {
  try {
    const response = await mailerLiteRequest('groups', { method: 'GET' });
    // MailerLite API v2 returns data in 'data' field
    return response?.data || [];
  } catch (error) {
    console.error('[mailerlite] Error fetching groups:', error);
    return [];
  }
}

/**
 * Create a group in MailerLite if it doesn't exist
 * Returns the group ID
 */
export async function ensureGroup(groupName: string): Promise<string | null> {
  try {
    // First, check if group already exists
    const existingGroups = await getGroups();
    const existingGroup = existingGroups.find(
      (g) => g.name.toLowerCase() === groupName.toLowerCase()
    );
    if (existingGroup) {
      return existingGroup.id;
    }

    // Create new group
    const response = await mailerLiteRequest('groups', {
      method: 'POST',
      body: JSON.stringify({ name: groupName }),
    });

    return response?.data?.id || null;
  } catch (error) {
    console.error(`[mailerlite] Error ensuring group "${groupName}":`, error);
    return null;
  }
}

/**
 * Get or create the three preference groups
 * Returns map of preference type -> group ID
 */
export async function ensurePreferenceGroups(): Promise<Map<string, string>> {
  const groupMap = new Map<string, string>();

  const groups = [
    { key: 'new-gameweek', name: 'New Gameweek Published' },
    { key: 'results-published', name: 'Results Published' },
    { key: 'news-updates', name: 'TOTL News & Updates' },
  ];

  for (const group of groups) {
    const groupId = await ensureGroup(group.name);
    if (groupId) {
      groupMap.set(group.key, groupId);
    }
  }

  return groupMap;
}

/**
 * Add or update a subscriber in MailerLite
 * If subscriber exists, updates their groups based on preferences
 * If subscriber doesn't exist, creates them
 */
export async function upsertSubscriber(
  email: string,
  preferences: {
    new_gameweek: boolean;
    results_published: boolean;
    news_updates: boolean;
  }
): Promise<boolean> {
  try {
    // Get group IDs for all preference types
    const groupMap = await ensurePreferenceGroups();
    
    // Determine which groups the user should be in based on preferences
    const groupsToAdd: string[] = [];
    if (preferences.new_gameweek && groupMap.has('new-gameweek')) {
      groupsToAdd.push(groupMap.get('new-gameweek')!);
    }
    if (preferences.results_published && groupMap.has('results-published')) {
      groupsToAdd.push(groupMap.get('results-published')!);
    }
    if (preferences.news_updates && groupMap.has('news-updates')) {
      groupsToAdd.push(groupMap.get('news-updates')!);
    }

    // Check if subscriber already exists
    let subscriberExists = false;
    try {
      const existing = await mailerLiteRequest(`subscribers/${encodeURIComponent(email)}`, {
        method: 'GET',
      });
      subscriberExists = !!existing?.data;
    } catch {
      // Subscriber doesn't exist, will create
      subscriberExists = false;
    }

    if (subscriberExists) {
      // Update existing subscriber
      // If user has any preferences enabled, keep them active
      // If all preferences disabled, unsubscribe them
      const hasAnyPreference = preferences.new_gameweek || preferences.results_published || preferences.news_updates;
      
      const updateData: any = {
        groups: groupsToAdd,
        status: hasAnyPreference ? 'active' : 'unsubscribed',
      };

      await mailerLiteRequest(`subscribers/${encodeURIComponent(email)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
    } else {
      // Create new subscriber
      // Only create if at least one preference is enabled
      const hasAnyPreference = preferences.new_gameweek || preferences.results_published || preferences.news_updates;
      
      if (!hasAnyPreference) {
        // Don't create subscriber if all preferences are disabled
        return true;
      }

      const subscriberData = {
        email,
        groups: groupsToAdd,
        status: 'active',
      };

      await mailerLiteRequest('subscribers', {
        method: 'POST',
        body: JSON.stringify(subscriberData),
      });
    }

    return true;
  } catch (error) {
    console.error(`[mailerlite] Error upserting subscriber ${email}:`, error);
    return false;
  }
}

/**
 * Remove subscriber from MailerLite (unsubscribe)
 * This is called when user opts out of all email preferences
 */
export async function unsubscribeSubscriber(email: string): Promise<boolean> {
  try {
    await mailerLiteRequest(`subscribers/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'unsubscribed' }),
    });
    return true;
  } catch (error) {
    console.error(`[mailerlite] Error unsubscribing ${email}:`, error);
    return false;
  }
}

/**
 * Check if user should receive a specific email type
 * Queries database for user's email preferences
 */
export async function shouldSendEmail(
  userId: string,
  emailType: 'new-gameweek' | 'results-published' | 'news-updates',
  supabase: any
): Promise<boolean> {
  try {
    const columnMap: Record<string, string> = {
      'new-gameweek': 'new_gameweek',
      'results-published': 'results_published',
      'news-updates': 'news_updates',
    };

    const columnName = columnMap[emailType];
    if (!columnName) {
      console.error(`[mailerlite] Unknown email type: ${emailType}`);
      return false;
    }

    const { data, error } = await supabase
      .from('email_preferences')
      .select(columnName)
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[mailerlite] Error checking email preferences:', error);
      return false;
    }

    // If no row exists, user hasn't opted in (default to false)
    // Only return true if explicitly set to true
    return data?.[columnName] === true;
  } catch (error) {
    console.error(`[mailerlite] Error checking should send email for user ${userId}:`, error);
    return false;
  }
}

