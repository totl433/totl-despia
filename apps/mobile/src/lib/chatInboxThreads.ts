import type { BrandedLeaderboardMyItem } from '@totl/domain';

type LeagueSummary = {
  id: string;
  name: string;
  avatar?: string | null;
};

type LeagueLastMessage = {
  content: string | null;
  created_at: string;
  user_id: string;
};

type BroadcastLastMessage = {
  content: string | null;
  created_at: string;
  user_id: string;
};

export type ChatInboxThreadRow =
  | {
      key: string;
      type: 'league';
      title: string;
      avatarUri: string | null;
      initials: string;
      unread: number;
      preview: string;
      when: string;
      lastAt: number;
      leagueId: string;
      routeName: 'ChatThread' | 'Chat2Thread';
    }
  | {
      key: string;
      type: 'broadcast';
      title: string;
      avatarUri: string | null;
      initials: string;
      unread: number;
      preview: string;
      when: string;
      lastAt: number;
      leaderboardId: string;
      canPostBroadcast: boolean;
    };

export function formatInboxTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(d, now)) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (isSameDay(d, y)) return 'Yesterday';

  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays >= 2 && diffDays <= 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  if (d.getFullYear() === now.getFullYear()) return `${dd}.${mm}`;

  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

export function buildInboxInitials(name: string, fallback = 'ML'): string {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
  return initials || fallback;
}

function sortRows(rows: ChatInboxThreadRow[]): ChatInboxThreadRow[] {
  return [...rows].sort((a, b) => {
    const aHasUnread = a.unread > 0 ? 1 : 0;
    const bHasUnread = b.unread > 0 ? 1 : 0;
    if (aHasUnread !== bHasUnread) return bHasUnread - aHasUnread;
    if (a.lastAt !== b.lastAt) return b.lastAt - a.lastAt;
    return a.title.localeCompare(b.title);
  });
}

export function buildChatInboxRows(input: {
  threadRouteName: 'ChatThread' | 'Chat2Thread';
  leagues: LeagueSummary[];
  unreadByLeagueId: Record<string, number>;
  lastLeagueMessageByLeagueId: Record<string, LeagueLastMessage>;
  leaguePreviewByLeagueId: Record<string, string>;
  brandedLeaderboards: BrandedLeaderboardMyItem[];
  unreadBroadcastByLeaderboardId: Record<string, number>;
  lastBroadcastByLeaderboardId: Record<string, BroadcastLastMessage>;
  broadcastPreviewByLeaderboardId: Record<string, string>;
}): ChatInboxThreadRow[] {
  const leagueRows: ChatInboxThreadRow[] = input.leagues.map((league) => {
    const leagueId = String(league.id);
    const last = input.lastLeagueMessageByLeagueId[leagueId] ?? null;
    return {
      key: `league:${leagueId}`,
      type: 'league',
      title: String(league.name ?? ''),
      avatarUri: typeof league.avatar === 'string' ? league.avatar : null,
      initials: buildInboxInitials(String(league.name ?? ''), 'ML'),
      unread: Number(input.unreadByLeagueId[leagueId] ?? 0),
      preview: input.leaguePreviewByLeagueId[leagueId] ?? 'No messages yet',
      when: last?.created_at ? formatInboxTimestamp(last.created_at) : '',
      lastAt: last?.created_at ? new Date(last.created_at).getTime() : 0,
      leagueId,
      routeName: input.threadRouteName,
    };
  });

  const broadcastRows: ChatInboxThreadRow[] = input.brandedLeaderboards.map((item) => {
    const leaderboardId = String(item.leaderboard.id);
    const last = input.lastBroadcastByLeaderboardId[leaderboardId] ?? null;
    return {
      key: `broadcast:${leaderboardId}`,
      type: 'broadcast',
      title: String(item.leaderboard.display_name ?? ''),
      avatarUri: item.leaderboard.header_image_url ?? null,
      initials: buildInboxInitials(String(item.leaderboard.display_name ?? ''), 'BC'),
      unread: Number(input.unreadBroadcastByLeaderboardId[leaderboardId] ?? 0),
      preview: input.broadcastPreviewByLeaderboardId[leaderboardId] ?? 'No broadcasts yet',
      when: last?.created_at ? formatInboxTimestamp(last.created_at) : '',
      lastAt: last?.created_at ? new Date(last.created_at).getTime() : 0,
      leaderboardId,
      canPostBroadcast: Boolean((item as any).canPostBroadcast),
    };
  });

  return sortRows([...leagueRows, ...broadcastRows]);
}
