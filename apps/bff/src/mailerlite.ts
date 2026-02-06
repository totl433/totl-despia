/**
 * MailerLite API utilities (Railway/BFF runtime).
 *
 * Ported from `netlify/functions/utils/mailerlite.ts` so the native app can update
 * email preferences via the BFF without calling Netlify functions directly.
 */
const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api';
const MAILERLITE_API_VERSION = '2024-01-01';

function getApiKey(): string {
  const key = process.env.MAILERLITE_API_KEY?.trim();
  if (!key) {
    throw new Error('MAILERLITE_API_KEY environment variable is not set (required for email preferences sync).');
  }
  return key;
}

async function mailerLiteRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = getApiKey();
  const url = `${MAILERLITE_API_BASE}/${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Version': MAILERLITE_API_VERSION,
    ...(options.headers ?? {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      // ignore
    }
    throw new Error(`MailerLite API error (${res.status}): ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) return (await res.json()) as unknown;
  return null;
}

type MailerLiteGroup = { id: string; name: string };

async function getGroups(): Promise<MailerLiteGroup[]> {
  try {
    const response = await mailerLiteRequest('groups', { method: 'GET' });
    return (response?.data ?? []) as MailerLiteGroup[];
  } catch {
    return [];
  }
}

async function ensureGroup(groupName: string): Promise<string | null> {
  try {
    const existingGroups = await getGroups();
    const existing = existingGroups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
    if (existing) return existing.id;

    const response = await mailerLiteRequest('groups', {
      method: 'POST',
      body: JSON.stringify({ name: groupName }),
    });
    return (response?.data?.id ?? null) as string | null;
  } catch {
    return null;
  }
}

async function ensurePreferenceGroups(): Promise<Map<string, string>> {
  const groupMap = new Map<string, string>();
  const groups = [
    { key: 'new-gameweek', name: 'New Gameweek Published' },
    { key: 'results-published', name: 'Results Published' },
    { key: 'news-updates', name: 'TOTL News & Updates' },
  ];

  for (const g of groups) {
    const id = await ensureGroup(g.name);
    if (id) groupMap.set(g.key, id);
  }
  return groupMap;
}

export async function upsertSubscriber(
  email: string,
  preferences: { new_gameweek: boolean; results_published: boolean; news_updates: boolean }
): Promise<boolean> {
  try {
    const groupMap = await ensurePreferenceGroups();
    const groupsToAdd: string[] = [];
    if (preferences.new_gameweek && groupMap.has('new-gameweek')) groupsToAdd.push(groupMap.get('new-gameweek')!);
    if (preferences.results_published && groupMap.has('results-published')) groupsToAdd.push(groupMap.get('results-published')!);
    if (preferences.news_updates && groupMap.has('news-updates')) groupsToAdd.push(groupMap.get('news-updates')!);

    // Determine whether subscriber exists.
    let subscriberExists = false;
    try {
      const existing = await mailerLiteRequest(`subscribers/${encodeURIComponent(email)}`, { method: 'GET' });
      subscriberExists = !!existing?.data;
    } catch {
      subscriberExists = false;
    }

    const hasAny = preferences.new_gameweek || preferences.results_published || preferences.news_updates;

    if (subscriberExists) {
      await mailerLiteRequest(`subscribers/${encodeURIComponent(email)}`, {
        method: 'PUT',
        body: JSON.stringify({
          groups: groupsToAdd,
          status: hasAny ? 'active' : 'unsubscribed',
        }),
      });
      return true;
    }

    // Only create if at least one preference enabled.
    if (!hasAny) return true;

    await mailerLiteRequest('subscribers', {
      method: 'POST',
      body: JSON.stringify({
        email,
        status: 'active',
        groups: groupsToAdd,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeSubscriber(email: string): Promise<boolean> {
  try {
    await mailerLiteRequest(`subscribers/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'unsubscribed', groups: [] }),
    });
    return true;
  } catch {
    return false;
  }
}

