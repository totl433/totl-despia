import React from 'react';
import { Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import MiniLeagueCard, { type MiniLeagueTableRowWithAvatar } from '../MiniLeagueCard';
import { api } from '../../lib/api';
import { resolveLeagueAvatarUri } from '../../lib/leagueAvatars';
import { DEV_FAKE_LEAGUE_MEMBERS, isDevFakeLeagueId } from '../../lib/devFakeLeague';

type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;
type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;

/**
 * Home mini-leagues LIVE mode card.
 *
 * Uses the existing designed `MiniLeagueCard` UI and backs it with the BFF
 * active-live table (`/v1/leagues/:leagueId/gw/:gw/table`).
 * Shows all members; unsubmitted ones are greyed out.
 */
export default function MiniLeagueLiveCard({
  leagueId,
  leagueName,
  leagueAvatar,
  gw,
  width,
  enabled,
  onPress,
  compact = false,
  currentUserId = null,
}: {
  leagueId: string;
  leagueName: string;
  leagueAvatar?: string | null;
  gw: number;
  width: number;
  enabled: boolean;
  onPress: () => void;
  compact?: boolean;
  currentUserId?: string | null;
}) {
  const isDevFakeLeague = isDevFakeLeagueId(leagueId);
  const { data: tableData, isLoading, isError } = useQuery<LeagueTableResponse>({
    enabled: enabled && typeof gw === 'number' && !isDevFakeLeague,
    queryKey: ['leagueGwTable', leagueId, gw],
    queryFn: () => api.getLeagueGwTable(leagueId, gw),
    staleTime: 10_000,
  });

  const { data: leagueData } = useQuery<LeagueMembersResponse>({
    enabled: enabled && typeof gw === 'number' && !isDevFakeLeague,
    queryKey: ['leagueMembers', leagueId],
    queryFn: () => api.getLeague(leagueId),
    staleTime: 10_000,
  });

  const members = isDevFakeLeague ? DEV_FAKE_LEAGUE_MEMBERS : (leagueData?.members ?? []);
  const table = tableData;
  const submittedUserIds = React.useMemo(
    () =>
      isDevFakeLeague
        ? DEV_FAKE_LEAGUE_MEMBERS.map((m) => String(m.id))
        : Array.isArray((table as any)?.submittedUserIds)
          ? ((table as any).submittedUserIds as unknown[]).map((x) => String(x))
          : [],
    [table, isDevFakeLeague]
  );

  const rows: MiniLeagueTableRowWithAvatar[] = React.useMemo(() => {
    if (isDevFakeLeague) {
      return DEV_FAKE_LEAGUE_MEMBERS.map((m, i) => ({
        user_id: String(m.id),
        name: m.name,
        score: 8 - i,
        unicorns: i === 0 ? 1 : 0,
        avatar_url: m.avatar_url,
      }));
    }
    const tbl = table as { rows?: Array<{ user_id: string; name?: string; score?: number; unicorns?: number; avatar_url?: string | null }> } | null | undefined;
    if (!tbl?.rows || !members.length) {
      return (tbl?.rows ?? []).map((r) => ({
        user_id: String(r.user_id),
        name: String(r.name ?? 'User'),
        score: Number(r.score ?? 0),
        unicorns: Number(r.unicorns ?? 0),
        avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
      }));
    }
    const rowsByUserId = new Map(
      tbl.rows.map((r) => [
        r.user_id,
        {
          user_id: String(r.user_id),
          name: String(r.name ?? 'User'),
          score: Number(r.score ?? 0),
          unicorns: Number(r.unicorns ?? 0),
          avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
        },
      ])
    );
    const submittedSet = new Set(submittedUserIds.map(String));
    const result: MiniLeagueTableRowWithAvatar[] = members.map((m: { id?: string; name?: string; avatar_url?: string | null }) => {
      const id = String(m.id ?? '');
      const row = rowsByUserId.get(id);
      if (row) return row;
      return {
        user_id: id,
        name: String(m.name ?? 'User'),
        score: 0,
        unicorns: 0,
        avatar_url: typeof m.avatar_url === 'string' && m.avatar_url.startsWith('http') ? m.avatar_url : null,
      };
    });
    result.sort((a, b) => {
      const aSub = submittedSet.has(a.user_id);
      const bSub = submittedSet.has(b.user_id);
      if (aSub && !bSub) return -1;
      if (!aSub && bSub) return 1;
      if (aSub && bSub) return b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [table, members, submittedUserIds, isDevFakeLeague]);

  const myRank = React.useMemo(() => {
    if (!currentUserId || !rows.length) return null;
    const idx = rows.findIndex((r) => String(r.user_id) === String(currentUserId));
    return idx >= 0 ? idx + 1 : null;
  }, [rows, currentUserId]);

  const submittedCount = React.useMemo(() => {
    if (isDevFakeLeague) return 8;
    const tbl = table as { submittedCount?: number } | null | undefined;
    return typeof tbl?.submittedCount === 'number' && Number.isFinite(tbl.submittedCount) ? tbl.submittedCount : null;
  }, [table, isDevFakeLeague]);

  const totalMembers = React.useMemo(() => {
    if (isDevFakeLeague) return 8;
    const tbl = table as { totalMembers?: number } | null | undefined;
    return typeof tbl?.totalMembers === 'number' && Number.isFinite(tbl.totalMembers) ? tbl.totalMembers : null;
  }, [table, isDevFakeLeague]);
  const showUnicorns = (totalMembers ?? members.length) >= 3;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open mini league ${leagueName}`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.96 : 1,
        transform: [{ scale: pressed ? 0.995 : 1 }],
      })}
    >
      <MiniLeagueCard
        title={leagueName}
        avatarUri={resolveLeagueAvatarUri(typeof leagueAvatar === 'string' ? leagueAvatar : null)}
        gwIsLive
        winnerChip={null}
        rows={rows}
        submittedUserIds={submittedUserIds}
        width={width}
        fixedRowCount={undefined}
        emptyLabel={isLoading ? 'Loading table…' : isError ? 'Couldn’t load table.' : 'No table yet.'}
        compact={compact}
        currentUserId={currentUserId}
        myRank={myRank}
        submittedCount={submittedCount}
        totalMembers={totalMembers}
        hideHeaderIndicators={!compact}
        showUnicorns={showUnicorns}
      />
    </Pressable>
  );
}

