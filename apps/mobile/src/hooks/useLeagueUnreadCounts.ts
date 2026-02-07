import { useLeagueUnreadCountsContext, type UnreadByLeagueId } from '../context/LeagueUnreadCountsContext';

export type { UnreadByLeagueId };

export function useLeagueUnreadCounts(): {
  meId: string | null;
  unreadByLeagueId: UnreadByLeagueId;
  optimisticallyClear: (leagueId: string) => void;
} {
  return useLeagueUnreadCountsContext();
}

