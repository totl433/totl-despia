import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import type { RootStackParamList } from '../navigation/AppNavigator';
import MiniLeagueListItem from '../components/miniLeagues/MiniLeagueListItem';
import PageHeader from '../components/PageHeader';
import { TotlRefreshControl } from '../lib/refreshControl';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import CreateJoinLeagueSheet from '../components/miniLeagues/CreateJoinLeagueSheet';
import { joinLeagueByCode } from '../services/leagues';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import CenteredSpinner from '../components/CenteredSpinner';
import { sortLeaguesByUnread } from '../lib/sortLeaguesByUnread';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';

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
  const { unreadByLeagueId, optimisticallyClear } = useLeagueUnreadCounts();
  const unread = Number(unreadByLeagueId[leagueId] ?? 0);

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
      avatarUri={resolveLeagueAvatarUri(typeof league.avatar === 'string' ? league.avatar : null)}
      submittedCount={typeof table?.submittedCount === 'number' ? table.submittedCount : null}
      totalMembers={typeof table?.totalMembers === 'number' ? table.totalMembers : members.length ?? null}
      membersPreview={members.slice(0, 4).map((m: any) => ({
        id: String(m.id),
        name: String(m.name ?? ''),
        avatarUri: typeof m.avatar_url === 'string' && m.avatar_url.startsWith('http') ? m.avatar_url : null,
      }))}
      unreadCount={unread}
      onPress={() => {
        onPress();
      }}
    />
  );
}

export default function LeaguesScreen() {
  const navigation = useNavigation<any>();
  const t = useTokens();
  const listRef = React.useRef<FlatList<LeagueSummary> | null>(null);
  useScrollToTop(listRef as any);
  const queryClient = useQueryClient();
  const { unreadByLeagueId, optimisticallyClear } = useLeagueUnreadCounts();
  const { data, isLoading, error, refetch, isRefetching } = useQuery<LeaguesResponse>({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const sortedLeagues = React.useMemo(() => {
    return sortLeaguesByUnread(data?.leagues ?? [], unreadByLeagueId);
  }, [data?.leagues, unreadByLeagueId]);

  const sortedLeaguesRef = React.useRef<LeagueSummary[]>([]);
  React.useEffect(() => {
    sortedLeaguesRef.current = sortedLeagues;
  }, [sortedLeagues]);

  const { data: home } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });
  const viewingGw = home?.viewingGw ?? null;

  const [createJoinOpen, setCreateJoinOpen] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState('');
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [joining, setJoining] = React.useState(false);

  const [visibleLeagueIds, setVisibleLeagueIds] = React.useState<Set<string>>(() => new Set());
  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 35 }).current;
  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: LeagueSummary; index: number | null; isViewable: boolean }> }) => {
      const leagueList: LeagueSummary[] = sortedLeaguesRef.current ?? [];
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

  // Initial/empty load: avoid rendering an empty list shell.
  if (isLoading && !data && !error) {
    return (
      <Screen fullBleed>
        <PageHeader
          title="Mini Leagues"
          subtitle="Create or join a private league with friends. Let the rivalry begin."
          rightAction={
            <Pressable
              onPress={() => {
                setJoinError(null);
                setCreateJoinOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Create or join mini league"
              style={({ pressed }) => ({
                width: 46,
                height: 46,
                borderRadius: 999,
                backgroundColor: t.color.brand,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 22, lineHeight: 22 }}>+</TotlText>
            </Pressable>
          }
        />
        <CenteredSpinner loading />
        <CreateJoinLeagueSheet
          open={createJoinOpen}
          onClose={() => setCreateJoinOpen(false)}
          joinCode={joinCode}
          setJoinCode={(next) => {
            setJoinError(null);
            setJoinCode(next);
          }}
          joinError={joinError}
          joining={joining}
          onPressCreate={() => {
            setCreateJoinOpen(false);
            navigation.navigate('CreateLeague');
          }}
          onPressJoin={() => {
            if (joining) return;
            const code = joinCode.trim().toUpperCase();
            setJoinError(null);
            setJoining(true);
            void (async () => {
              const res = await joinLeagueByCode(code);
              if (!res.ok) {
                setJoinError(res.error);
                setJoining(false);
                return;
              }
              setJoining(false);
              setCreateJoinOpen(false);
              setJoinCode('');
              await queryClient.invalidateQueries({ queryKey: ['leagues'] });
              navigation.navigate('LeagueDetail', { leagueId: res.league.id, name: res.league.name } as const);
            })();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      <PageHeader
        title="Mini Leagues"
        subtitle="Create or join a private league with friends. Let the rivalry begin."
        rightAction={
          <Pressable
            onPress={() => {
              setJoinError(null);
              setCreateJoinOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Create or join mini league"
            style={({ pressed }) => ({
              width: 46,
              height: 46,
              borderRadius: 999,
              backgroundColor: t.color.brand,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 22, lineHeight: 22 }}>+</TotlText>
          </Pressable>
        }
      />

      <FlatList
        ref={listRef}
        data={sortedLeagues}
        style={{ flex: 1 }}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListHeaderComponent={
          <>
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
                onPress={() => {
                  setJoinError(null);
                  setCreateJoinOpen(true);
                }}
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
              onPress={() => {
                navigation.navigate(
                  'LeagueDetail',
                  { leagueId: item.id, name: item.name } satisfies RootStackParamList['LeagueDetail']
                );
              }}
            />
          );
        }}
      />

      <CreateJoinLeagueSheet
        open={createJoinOpen}
        onClose={() => setCreateJoinOpen(false)}
        joinCode={joinCode}
        setJoinCode={(next) => {
          setJoinError(null);
          setJoinCode(next);
        }}
        joinError={joinError}
        joining={joining}
        onPressCreate={() => {
          setCreateJoinOpen(false);
          // Route will be added in `LeaguesNavigator` as part of the plan.
          navigation.navigate('CreateLeague');
        }}
        onPressJoin={() => {
          if (joining) return;
          const code = joinCode.trim().toUpperCase();
          setJoinError(null);
          setJoining(true);
          void (async () => {
            const res = await joinLeagueByCode(code);
            if (!res.ok) {
              setJoinError(res.error);
              setJoining(false);
              return;
            }
            setJoining(false);
            setCreateJoinOpen(false);
            setJoinCode('');
            await queryClient.invalidateQueries({ queryKey: ['leagues'] });
            navigation.navigate('LeagueDetail', { leagueId: res.league.id, name: res.league.name } as const);
          })();
        }}
      />
    </Screen>
  );
}

