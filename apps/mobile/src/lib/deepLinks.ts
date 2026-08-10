export type LeagueDeepLinkInitialTab = 'gwTable' | 'predictions' | 'season';
export const APP_LINK_BASE_URL = 'https://playtotl.com';

export type DeepLinkTarget =
  | { type: 'join'; code: string }
  | { type: 'leagues' }
  | { type: 'predictions' }
  | { type: 'brandedLeaderboard'; idOrSlug: string; initialTab?: 'broadcast' }
  | {
      type: 'league';
      code: string;
      openChat: boolean;
      initialTab?: LeagueDeepLinkInitialTab;
    };

export function buildLeagueAppLink(code: string, tab?: 'chat' | 'predictions'): string {
  const path = `${APP_LINK_BASE_URL}/league/${encodeURIComponent(String(code).trim().toUpperCase())}`;
  return tab ? `${path}?tab=${tab}` : path;
}

function parseIncomingUrl(rawUrl: string): URL | null {
  try {
    if (rawUrl.startsWith('/')) {
      return new URL(`https://totl.local${rawUrl}`);
    }

    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) return null;

    const parsed = new URL(rawUrl);
    // Older notification builds emitted `scheme://league/CODE`, where
    // `league` is parsed as the hostname. Normalize that legacy form.
    if (parsed.protocol === 'com.despia.totlnative:' && parsed.hostname) {
      return new URL(
        `https://totl.local/${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`
      );
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolveDeepLinkTarget(rawUrl: string): DeepLinkTarget | null {
  const parsed = parseIncomingUrl(String(rawUrl ?? '').trim());
  if (!parsed) return null;

  const pathname = parsed.pathname;

  const joinMatch = pathname.match(/^\/join\/([^/?#]+)\/?$/i);
  if (joinMatch?.[1]) {
    const code = decodeURIComponent(joinMatch[1]).trim().toUpperCase();
    return code ? { type: 'join', code } : null;
  }

  if (/^\/leagues\/?$/i.test(pathname)) {
    return { type: 'leagues' };
  }

  if (/^\/predictions\/?$/i.test(pathname)) {
    return { type: 'predictions' };
  }

  const brandedMatch = pathname.match(/^\/branded-leaderboards\/([^/?#]+)\/?$/i);
  if (brandedMatch?.[1]) {
    const idOrSlug = decodeURIComponent(brandedMatch[1]).trim();
    if (!idOrSlug) return null;
    const tab = (parsed.searchParams.get('tab') ?? '').trim().toLowerCase();
    return {
      type: 'brandedLeaderboard',
      idOrSlug,
      initialTab: tab === 'broadcast' ? 'broadcast' : undefined,
    };
  }

  const leagueMatch = pathname.match(/^\/league\/([^/?#]+)(?:\/chat)?\/?$/i);
  const queryLeagueCode = parsed.searchParams.get('leagueCode');
  const rawCode = leagueMatch?.[1] ?? queryLeagueCode ?? '';
  const code = decodeURIComponent(rawCode).trim().toUpperCase();
  if (!code) return null;

  const tab = (parsed.searchParams.get('tab') ?? '').trim().toLowerCase();
  const openChat = tab === 'chat' || /\/chat\/?$/i.test(pathname);
  let initialTab: LeagueDeepLinkInitialTab | undefined;
  if (!openChat) {
    if (tab === 'predictions') initialTab = 'predictions';
    else if (tab === 'season') initialTab = 'season';
    else if (tab === 'gw' || tab === 'gwtable' || tab === 'table') initialTab = 'gwTable';
  }

  return { type: 'league', code, openChat, initialTab };
}

export function getDeepLinkDedupeKey(rawUrl: string): string | null {
  const target = resolveDeepLinkTarget(rawUrl);
  return target ? JSON.stringify(target) : null;
}
