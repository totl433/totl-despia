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
 * 
 * Environment variable must be set in Netlify dashboard:
 * Site settings > Environment variables > MAILERLITE_API_KEY
 * 
 * Ensure it's set for the correct scopes (production, deploy previews, branch deploys)
 */
function getApiKey(): string {
  const key = process.env.MAILERLITE_API_KEY?.trim();
  
  if (!key) {
    // Log diagnostic info to help debug env var issues
    const envKeys = Object.keys(process.env);
    const mailerKeys = envKeys.filter(k => k.includes('MAILER') || k.includes('MAIL'));
    console.error('[mailerlite] MAILERLITE_API_KEY not found in environment');
    console.error('[mailerlite] Available env keys (first 50):', envKeys.slice(0, 50));
    console.error('[mailerlite] Keys containing "MAILER" or "MAIL":', mailerKeys);
    console.error('[mailerlite] Context:', process.env.CONTEXT || 'unknown');
    console.error('[mailerlite] Branch:', process.env.BRANCH || process.env.COMMIT_REF || 'unknown');
    throw new Error('MAILERLITE_API_KEY environment variable is not set. Please set it in Netlify dashboard under Site settings > Environment variables.');
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

