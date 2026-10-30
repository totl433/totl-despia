import React from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { isDevFakeLeagueId } from '../lib/devFakeLeague';

type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;

export type LeaguesMissingPicks = {
  /** Leagues with two or more members, so a "missing" count means something. */
  leagueCount: number;
  /** Ids of those leagues where someone hasn't submitted for the gameweek. */
  missingLeagueIds: Set<string>;
};

/** A league is missing picks when it has at least two members and not all of them have submitted. */
export function leagueIsMissingPicks(table: Pick<LeagueTableResponse, 'submittedCount' | 'totalMembers'>): boolean {
  return table.totalMembers >= 2 && table.submittedCount < table.totalMembers;
}

/**
 * Which of your mini-leagues still have someone to submit for `gw`. Shares the per-league table
 * cache with the Mini Leagues list, so opening that list after the feed costs nothing extra.
 * Null until every league has loaded.
 */
export function useLeaguesMissingPicks(gw: number | null, enabled = true): LeaguesMissingPicks | null {
  const on = enabled && typeof gw === 'number';
  const { data } = useQuery<LeaguesResponse>({
    enabled: on,
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });
  const leagueIds = React.useMemo(
    () => (data?.leagues ?? []).map((league) => String(league.id)).filter((id) => !isDevFakeLeagueId(id)),
    [data]
  );
  const tables = useQueries({
    queries: leagueIds.map((leagueId) => ({
      enabled: on,
      queryKey: ['leagueGwTable', leagueId, gw],
      queryFn: () => api.getLeagueGwTable(leagueId, gw as number),
      staleTime: 60_000,
    })),
  });

  const loaded = on && !!data && tables.every((q) => q.data || q.isError);
  const missingKey = tables.map((q) => (q.data ? `${q.data.submittedCount}/${q.data.totalMembers}` : '-')).join(',');
  return React.useMemo(() => {
    if (!loaded) return null;
    let leagueCount = 0;
    const missingLeagueIds = new Set<string>();
    tables.forEach((q, i) => {
      if (!q.data || q.data.totalMembers < 2) return;
      leagueCount += 1;
      if (leagueIsMissingPicks(q.data)) missingLeagueIds.add(leagueIds[i]);
    });
    return { leagueCount, missingLeagueIds };
    // `missingKey` stands in for `tables`, which is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, missingKey, leagueIds]);
}
