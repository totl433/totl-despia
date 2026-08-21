export const PUBLIC_APP_ORIGIN = 'https://playtotl.com';

export function buildLeaguePublicUrl(code: string, tab?: 'chat' | 'gw'): string {
  const path = `/league/${encodeURIComponent(String(code).trim().toUpperCase())}`;
  return `${PUBLIC_APP_ORIGIN}${path}${tab ? `?tab=${tab}` : ''}`;
}

export function canonicalizePublicAppUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  if (raw.startsWith('/')) return `${PUBLIC_APP_ORIGIN}${raw}`;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return raw;
    if (parsed.hostname !== 'playtotl.com' && parsed.hostname !== 'totl-staging.netlify.app') return raw;
    return `${PUBLIC_APP_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return raw;
  }
}

export function canonicalizeNotificationData(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return data;
  const result = { ...data };
  for (const key of ['url', 'navigateTo'] as const) {
    const canonical = canonicalizePublicAppUrl(result[key]);
    if (canonical) result[key] = canonical;
  }
  return result;
}
