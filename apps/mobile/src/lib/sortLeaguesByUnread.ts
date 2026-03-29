export function sortLeaguesByUnread<T extends { id: string | number }>(
  leagues: T[],
  unreadByLeagueId: Record<string, number>
): T[] {
  const withIdx = leagues.map((l, idx) => ({ l, idx }));
  withIdx.sort((a, b) => {
    const aUnread = Number(unreadByLeagueId[String(a.l.id)] ?? 0);
    const bUnread = Number(unreadByLeagueId[String(b.l.id)] ?? 0);
    const aHas = aUnread > 0 ? 1 : 0;
    const bHas = bUnread > 0 ? 1 : 0;

    if (aHas !== bHas) return bHas - aHas; // unread first
    if (aUnread !== bUnread) return bUnread - aUnread; // higher unread first
    return a.idx - b.idx; // stable tie-breaker
  });
  return withIdx.map((x) => x.l);
}

