import React from 'react';
import { Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import MiniLeagueCard, { type MiniLeagueTableRowWithAvatar } from '../MiniLeagueCard';
import { api } from '../../lib/api';
import { resolveLeagueAvatarUri } from '../../lib/leagueAvatars';

type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;

/**
 * Home mini-leagues LIVE mode card.
 *
 * Uses the existing designed `MiniLeagueCard` UI and backs it with the BFF
 * active-live table (`/v1/leagues/:leagueId/gw/:gw/table`).
 */
export default function MiniLeagueLiveCard({
  leagueId,
  leagueName,
  leagueAvatar,
  gw,
  width,
  enabled,
  onPress,
}: {
  leagueId: string;
  leagueName: string;
  leagueAvatar?: string | null;
  gw: number;
  width: number;
  enabled: boolean;
  onPress: () => void;
}) {
  const { data, isLoading } = useQuery<LeagueTableResponse>({
    enabled: enabled && typeof gw === 'number',
    queryKey: ['leagueGwTable', leagueId, gw],
    queryFn: () => api.getLeagueGwTable(leagueId, gw),
    staleTime: 10_000,
  });

  const rows: MiniLeagueTableRowWithAvatar[] = React.useMemo(() => {
    return (data?.rows ?? []).map((r) => ({
      user_id: String(r.user_id),
      name: String(r.name ?? 'User'),
      score: Number(r.score ?? 0),
      unicorns: Number(r.unicorns ?? 0),
      avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
    }));
  }, [data?.rows]);

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
        width={width}
        fixedRowCount={4}
        emptyLabel={isLoading ? 'Loading table…' : 'No table yet.'}
      />
    </Pressable>
  );
}

