import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';
import MiniLeaguesHeader from '../components/miniLeagues/MiniLeaguesHeader';
import MiniLeagueListItem from '../components/miniLeagues/MiniLeagueListItem';

type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
type LeagueSummary = LeaguesResponse['leagues'][number];
type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;

function ordinal(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function LeagueRow({
  league,
  enabled,
  viewingGw,
  onPress,
}: {
  league: LeagueSummary;
  enabled: boolean;
  viewingGw: number | null;
  onPress: () => void;
}) {
  const leagueId = String(league.id);

  const { data: membersData } = useQuery<LeagueMembersResponse>({
    enabled,
    queryKey: ['leagueMembers', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });

  const { data: table } = useQuery<LeagueTableResponse>({
    enabled: enabled && typeof viewingGw === 'number',
    queryKey: ['leagueGwTable', leagueId, viewingGw],
    queryFn: () => api.getLeagueGwTable(leagueId, viewingGw as number),
  });

  const members = membersData?.members ?? [];
  const allSubmitted = !!table && table.submittedCount === table.totalMembers && table.totalMembers > 0;

  // Best effort: show your current position if the table includes you.
  // If BFF doesn't return user_id rows for you, this will safely fall back to null.
  const userRank = (() => {
    const rows = (table?.rows ?? []) as Array<{ user_id?: string | null }>;
    // No user id available in this screen yet; show rank only if backend sends it later.
    // (We’ll wire in userId once auth context is available here.)
    void rows;
    return null;
  })();

  return (
    <MiniLeagueListItem
      title={String(league.name ?? '')}
      avatarUri={typeof league.avatar === 'string' && league.avatar.startsWith('http') ? league.avatar : null}
      allSubmitted={allSubmitted}
      membersCount={table?.totalMembers ?? members.length ?? null}
      userRank={userRank}
      rankDelta={null}
      membersPreview={members.slice(0, 4).map((m) => ({ id: String(m.id), name: String(m.name ?? '') }))}
      onPress={onPress}
    />
  );
}

export default function LeaguesScreen() {
  const navigation = useNavigation<any>();
  const t = useTokens();
  const { data, isLoading, error, refetch, isRefetching } = useQuery<LeaguesResponse>({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const { data: home } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });
  const viewingGw = home?.viewingGw ?? null;

  const [visibleLeagueIds, setVisibleLeagueIds] = React.useState<Set<string>>(() => new Set());
  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 35 }).current;
  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: LeagueSummary; index: number | null; isViewable: boolean }> }) => {
      const leagueList: LeagueSummary[] = data?.leagues ?? [];
      const next = new Set<string>();

      viewableItems.forEach((vi) => {
        if (!vi?.isViewable) return;
        const item = vi.item;
        if (item?.id) next.add(String(item.id));
        const idx = typeof vi.index === 'number' ? vi.index : null;
        if (idx === null) return;
        const prev = leagueList[idx - 1];
        const nextItem = leagueList[idx + 1];
        if (prev?.id) next.add(String(prev.id));
        if (nextItem?.id) next.add(String(nextItem.id));
      });

      setVisibleLeagueIds((prev) => {
        if (prev.size === next.size) {
          let same = true;
          for (const id of prev) {
            if (!next.has(id)) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return next;
      });
    }
  ).current;

  return (
    <Screen fullBleed>
      <FlatList
        data={data?.leagues ?? []}
        style={{ flex: 1 }}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ padding: t.space[4], paddingBottom: t.space[8] }}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListHeaderComponent={
          <>
            <MiniLeaguesHeader title="Mini Leagues" onPressAdd={() => {}} />
            {isLoading && <TotlText variant="muted">Loading…</TotlText>}
            {error && (
              <Card style={{ marginBottom: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load leagues
                </TotlText>
                <TotlText variant="muted">{(error as Error)?.message ?? 'Unknown error'}</TotlText>
              </Card>
            )}
          </>
        }
        ListEmptyComponent={
          !isLoading && !error ? (
            <Card>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                No leagues yet
              </TotlText>
              <TotlText variant="muted">Once you join or create one, it’ll show up here.</TotlText>
            </Card>
          ) : null
        }
        ListFooterComponent={
          (data?.leagues?.length ?? 0) > 0 ? (
            <View style={{ marginTop: 14, marginBottom: 6 }}>
              <Pressable
                onPress={() => {}}
                style={({ pressed }) => ({
                  width: '100%',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: t.color.brand,
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <TotlText style={{ color: '#FFFFFF', fontWeight: '900', textAlign: 'center' }}>Create or Join</TotlText>
              </Pressable>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const leagueId = String(item.id);
          const enabled = visibleLeagueIds.has(leagueId);

          return (
            <LeagueRow
              league={item}
              enabled={enabled}
              viewingGw={viewingGw}
              onPress={() =>
                navigation.navigate(
                  'LeagueDetail',
                  { leagueId: item.id, name: item.name } satisfies LeaguesStackParamList['LeagueDetail']
                )
              }
            />
          );
        }}
      />
    </Screen>
  );
}

