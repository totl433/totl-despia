import React from 'react';
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import { useSharedValue } from 'react-native-reanimated';

import { api } from '../lib/api';
import type { RootStackParamList } from '../navigation/AppNavigator';
import MiniLeagueListItem from '../components/miniLeagues/MiniLeagueListItem';
import { TotlRefreshControl } from '../lib/refreshControl';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import CreateJoinLeagueSheet from '../components/miniLeagues/CreateJoinLeagueSheet';
import { joinLeagueByCode } from '../services/leagues';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import CenteredSpinner from '../components/CenteredSpinner';
import { sortLeaguesByUnread } from '../lib/sortLeaguesByUnread';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { resolveLeagueStartGw } from '../lib/leagueStart';
import { getGameweekStateFromSnapshot } from '../lib/gameweekState';
import MiniLeagueLiveCard from '../components/home/MiniLeagueLiveCard';
import CarouselDots from '../components/home/CarouselDots';
import AppTopHeader from '../components/AppTopHeader';
import SegmentedPillControl from '../components/SegmentedPillControl';

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
  currentGw,
  meId,
  fallbackMeId,
  onPress,
}: {
  league: LeagueSummary;
  enabled: boolean;
  currentGw: number | null;
  meId: string | null;
  fallbackMeId: string | null;
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
    enabled: enabled && typeof currentGw === 'number',
    queryKey: ['leagueGwTable', leagueId, currentGw],
    queryFn: () => api.getLeagueGwTable(leagueId, currentGw as number),
  });

  const members = membersData?.members ?? [];
  const allSubmitted = !!table && table.submittedCount === table.totalMembers && table.totalMembers > 0;

  const memberCount: number | null =
    typeof table?.totalMembers === 'number' && Number.isFinite(table.totalMembers)
      ? table.totalMembers
      : typeof members.length === 'number'
        ? members.length
        : null;

  const { data: resolvedLeagueStartGw } = useQuery<number>({
    enabled: enabled && typeof currentGw === 'number' && !!leagueId,
    queryKey: [
      'leagueStartGw',
      leagueId,
      currentGw,
      String((membersData as any)?.league?.name ?? league.name ?? ''),
      String((membersData as any)?.league?.created_at ?? ''),
    ],
    queryFn: async () =>
      resolveLeagueStartGw(
        {
          id: leagueId,
          name: String((membersData as any)?.league?.name ?? league.name ?? ''),
          created_at:
            typeof (membersData as any)?.league?.created_at === 'string' ? String((membersData as any).league.created_at) : undefined,
        },
        currentGw as number
      ),
    staleTime: 5 * 60_000,
  });

  const effectiveMeId = meId ?? fallbackMeId ?? null;

  const { data: seasonRankData } = useQuery<{ myRank: number | null; orderedUserIds: string[] }>({
    enabled:
      enabled &&
      members.length > 0 &&
      typeof currentGw === 'number' &&
      typeof resolvedLeagueStartGw === 'number',
    queryKey: [
      'leagueSeasonRank',
      leagueId,
      effectiveMeId,
      currentGw,
      resolvedLeagueStartGw,
      members.map((m: any) => String(m.id ?? '')).join(','),
    ],
    queryFn: async () => {
      const memberIds = members.map((m: any) => String(m.id ?? ''));
      if (!memberIds.length) return { myRank: null, orderedUserIds: memberIds };
      const latestGw = currentGw as number;
      const seasonStartGw = resolvedLeagueStartGw as number;
      const showUnicorns = memberIds.length >= 3;

      const resultsRes = await (supabase as any)
        .from('app_gw_results')
        .select('gw,fixture_index,result')
        .gte('gw', seasonStartGw)
        .lte('gw', latestGw);
      if (resultsRes.error) throw resultsRes.error;

      const results: Array<{ gw: number; fixture_index: number; result: 'H' | 'D' | 'A' | string }> = resultsRes.data ?? [];
      const outcomeByGwFixture = new Map<string, 'H' | 'D' | 'A'>();
      results.forEach((r) => {
        if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') return;
        outcomeByGwFixture.set(`${r.gw}:${r.fixture_index}`, r.result);
      });

      const gwsWithResults = Array.from(
        new Set(
          Array.from(outcomeByGwFixture.keys())
            .map((k) => Number.parseInt(k.split(':')[0] ?? '', 10))
            .filter((n) => Number.isFinite(n))
        )
      ).sort((a, b) => a - b);

      let relevantGws = gwsWithResults.filter((gw) => gw >= seasonStartGw);

      if (relevantGws.includes(latestGw)) {
        const fixturesForCurrentGwRes = await (supabase as any).from('app_fixtures').select('fixture_index').eq('gw', latestGw);
        if (fixturesForCurrentGwRes.error) throw fixturesForCurrentGwRes.error;
        const fixtureCount = (fixturesForCurrentGwRes.data ?? []).length;
        const resultCountForCurrentGw = Array.from(outcomeByGwFixture.keys()).filter(
          (k) => Number.parseInt(k.split(':')[0] ?? '', 10) === latestGw
        ).length;
        if (fixtureCount > 0 && resultCountForCurrentGw < fixtureCount) {
          relevantGws = relevantGws.filter((gw) => gw < latestGw);
        }
      } else {
        relevantGws = relevantGws.filter((gw) => gw < latestGw);
      }

      if (relevantGws.length === 0) return { myRank: null, orderedUserIds: memberIds };

      const picksRes = await (supabase as any)
        .from('app_picks')
        .select('user_id,gw,fixture_index,pick')
        .in('user_id', memberIds)
        .in('gw', relevantGws);
      if (picksRes.error) throw picksRes.error;

      const picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }> = picksRes.data ?? [];

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      relevantGws.forEach((g) => {
        const m = new Map<string, GwScore>();
        memberIds.forEach((uid) => m.set(uid, { user_id: uid, score: 0, unicorns: 0 }));
        perGw.set(g, m);
      });

      const picksByGwFixture = new Map<string, Array<{ user_id: string; pick: string }>>();
      picks.forEach((p) => {
        const key = `${p.gw}:${p.fixture_index}`;
        const arr = picksByGwFixture.get(key) ?? [];
        arr.push({ user_id: p.user_id, pick: p.pick });
        picksByGwFixture.set(key, arr);
      });

      relevantGws.forEach((gw) => {
        const gwMap = perGw.get(gw)!;
        const outcomesForGw = Array.from(outcomeByGwFixture.entries())
          .filter(([k]) => Number.parseInt(k.split(':')[0] ?? '', 10) === gw)
          .map(([k, out]) => ({ fixtureIndex: Number.parseInt(k.split(':')[1] ?? '', 10), out }))
          .filter((x) => Number.isFinite(x.fixtureIndex));

        outcomesForGw.forEach(({ fixtureIndex, out }) => {
          const these = picksByGwFixture.get(`${gw}:${fixtureIndex}`) ?? [];
          const correct = these.filter((p) => p.pick === out).map((p) => p.user_id);
          these.forEach((p) => {
            if (p.pick !== out) return;
            const row = gwMap.get(p.user_id);
            if (row) row.score += 1;
          });
          if (showUnicorns && correct.length === 1) {
            const lone = gwMap.get(correct[0]!);
            if (lone) lone.unicorns += 1;
          }
        });
      });

      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      memberIds.forEach((uid) => {
        mltPts.set(uid, 0);
        ocp.set(uid, 0);
        unis.set(uid, 0);
      });

      relevantGws.forEach((g) => {
        const rows = Array.from(perGw.get(g)!.values());
        rows.forEach((r) => {
          ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
          unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
        });

        rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
        if (!rows.length) return;
        const top = rows[0];
        const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
        if (coTop.length === 1) {
          mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
        } else {
          coTop.forEach((r) => mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1));
        }
      });

      const nameById = new Map<string, string>();
      members.forEach((m: any) => nameById.set(String(m.id ?? ''), String(m.name ?? 'User')));

      const orderedIds = memberIds
        .slice()
        .sort((a, b) => {
          const aPts = mltPts.get(a) ?? 0;
          const bPts = mltPts.get(b) ?? 0;
          if (bPts !== aPts) return bPts - aPts;
          const aUnis = unis.get(a) ?? 0;
          const bUnis = unis.get(b) ?? 0;
          if (bUnis !== aUnis) return bUnis - aUnis;
          const aOcp = ocp.get(a) ?? 0;
          const bOcp = ocp.get(b) ?? 0;
          if (bOcp !== aOcp) return bOcp - aOcp;
          return (nameById.get(a) ?? '').localeCompare(nameById.get(b) ?? '');
        });

      const idx = effectiveMeId ? orderedIds.findIndex((id) => id === String(effectiveMeId)) : -1;
      return { myRank: idx >= 0 ? idx + 1 : null, orderedUserIds: orderedIds };
    },
    staleTime: 30_000,
  });

  const currentRank = seasonRankData?.myRank ?? null;
  const orderedUserIds = seasonRankData?.orderedUserIds ?? [];
  const memberOrder = React.useMemo(() => {
    const out = new Map<string, number>();
    orderedUserIds.forEach((id, idx) => out.set(String(id), idx));
    return out;
  }, [orderedUserIds]);

  return (
    <MiniLeagueListItem
      title={String(league.name ?? '')}
      avatarUri={resolveLeagueAvatarUri(typeof league.avatar === 'string' ? league.avatar : null)}
      submittedCount={typeof table?.submittedCount === 'number' ? table.submittedCount : null}
      totalMembers={typeof table?.totalMembers === 'number' ? table.totalMembers : members.length ?? null}
      membersPreview={(() => {
        const submitted = new Set<string>(
          Array.isArray((table as any)?.submittedUserIds)
            ? ((table as any).submittedUserIds as unknown[]).map((x) => String(x))
            : (table?.rows ?? []).map((r: any) => String(r?.user_id ?? '')).filter(Boolean)
        );
        return members
          .map((m: any) => {
          const id = String(m.id);
          return {
            id,
            name: String(m.name ?? ''),
            avatarUri: typeof m.avatar_url === 'string' && m.avatar_url.startsWith('http') ? m.avatar_url : null,
            hasSubmitted: submitted.has(id),
          };
          })
          .sort((a, b) => {
            const aOrder = memberOrder.get(a.id);
            const bOrder = memberOrder.get(b.id);
            if (typeof aOrder === 'number' && typeof bOrder === 'number') return aOrder - bOrder;
            if (typeof aOrder === 'number') return -1;
            if (typeof bOrder === 'number') return 1;
            return a.name.localeCompare(b.name);
          });
      })()}
      memberCount={memberCount}
      myRank={currentRank}
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
  const { width: screenWidth } = useWindowDimensions();
  const listRef = React.useRef<FlatList<LeagueSummary> | null>(null);
  useScrollToTop(listRef as any);
  const queryClient = useQueryClient();
  const { unreadByLeagueId, meId: unreadMeId } = useLeagueUnreadCounts();
  const { data: authUser } = useQuery<any | null>({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const meId = authUser?.id ? String(authUser.id) : null;
  const { data: avatarRow } = useQuery<{ avatar_url: string | null } | null>({
    enabled: !!meId,
    queryKey: ['profile-avatar-url', meId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('avatar_url').eq('id', meId).maybeSingle();
      if (error && (error as any).code !== 'PGRST116') throw error;
      if (!data) return null;
      return { avatar_url: typeof (data as any).avatar_url === 'string' ? (data as any).avatar_url : null };
    },
    staleTime: 60_000,
  });
  const avatarUrl = typeof avatarRow?.avatar_url === 'string' ? String(avatarRow.avatar_url) : null;
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
  const currentGw = home?.currentGw ?? viewingGw ?? null;
  const showTopLiveRail = typeof viewingGw === 'number' && sortedLeagues.length > 0;
  const tablesToggleLabel = typeof viewingGw === 'number' ? `Gameweek ${viewingGw} Tables` : 'Gameweek Tables';
  const gwState = React.useMemo(() => {
    if (!home) return null;
    return getGameweekStateFromSnapshot({
      fixtures: home.fixtures ?? [],
      liveScores: home.liveScores ?? [],
      hasSubmittedViewingGw: !!home.hasSubmittedViewingGw,
    });
  }, [home]);
  const showReadyToMoveOn =
    typeof currentGw === 'number' && typeof viewingGw === 'number' ? viewingGw < currentGw : false;
  const canToggleViews = showTopLiveRail && (gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW' || showReadyToMoveOn);
  const liveCardWidth = Math.min(336, Math.max(260, screenWidth - t.space[4] * 2 - 22));
  const liveRailGap = 10;
  const liveRailItemSpan = liveCardWidth + liveRailGap;
  const liveRailRef = React.useRef<ScrollView | null>(null);
  const liveRailProgress = useSharedValue(0);
  const [activeLiveRailIndex, setActiveLiveRailIndex] = React.useState(0);
  const [topViewMode, setTopViewMode] = React.useState<'tables' | 'list'>('tables');
  const showTablesView = canToggleViews && topViewMode === 'tables';
  const showListView = !canToggleViews || topViewMode === 'list';

  const [createJoinOpen, setCreateJoinOpen] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState('');
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [joining, setJoining] = React.useState(false);

  const [visibleLeagueIds, setVisibleLeagueIds] = React.useState<Set<string>>(() => new Set());
  const renderCreateJoinHeaderButton = React.useCallback(
    () => (
      <Pressable
        onPress={() => {
          setJoinError(null);
          setCreateJoinOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Create or join mini league"
        style={({ pressed }) => ({
          width: 38,
          height: 38,
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
        <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 20, lineHeight: 20 }}>+</TotlText>
      </Pressable>
    ),
    [t.color.brand]
  );
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

  React.useEffect(() => {
    if (sortedLeagues.length <= 1) {
      if (activeLiveRailIndex !== 0) setActiveLiveRailIndex(0);
      liveRailProgress.value = 0;
      return;
    }
    const maxIndex = sortedLeagues.length - 1;
    if (activeLiveRailIndex > maxIndex) {
      setActiveLiveRailIndex(maxIndex);
      liveRailProgress.value = maxIndex;
    }
  }, [activeLiveRailIndex, sortedLeagues.length, liveRailProgress]);

  // Initial/empty load: avoid rendering an empty list shell.
  if (isLoading && !data && !error) {
    return (
      <Screen fullBleed>
        <AppTopHeader
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => navigation.navigate('Profile')}
          avatarUrl={avatarUrl}
          title="Mini Leagues"
          leftAction={renderCreateJoinHeaderButton()}
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
      <AppTopHeader
        onPressChat={() => navigation.navigate('ChatHub')}
        onPressProfile={() => navigation.navigate('Profile')}
        avatarUrl={avatarUrl}
        title="Mini Leagues"
        leftAction={renderCreateJoinHeaderButton()}
      />

      <FlatList
        ref={listRef}
        data={showListView ? sortedLeagues : []}
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
            {showTopLiveRail ? (
              <View style={{ marginBottom: 14 }}>
                {canToggleViews ? (
                  <View style={{ marginBottom: 10 }}>
                    <SegmentedPillControl
                      items={[
                        { key: 'tables', label: tablesToggleLabel },
                        { key: 'list', label: 'List View' },
                      ]}
                      value={topViewMode}
                      onChange={setTopViewMode}
                      height={40}
                    />
                  </View>
                ) : null}
                {showTablesView ? (
                  <>
                    <ScrollView
                      ref={liveRailRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingRight: 8 }}
                      snapToInterval={liveRailItemSpan}
                      snapToAlignment="start"
                      decelerationRate="fast"
                      disableIntervalMomentum
                      bounces={false}
                      scrollEventThrottle={16}
                      onScroll={(event) => {
                        const x = event.nativeEvent.contentOffset.x;
                        liveRailProgress.value = x > 0 ? x / liveRailItemSpan : 0;
                      }}
                      onMomentumScrollEnd={(event) => {
                        const x = event.nativeEvent.contentOffset.x;
                        const maxIndex = Math.max(0, sortedLeagues.length - 1);
                        const nextIndex = Math.min(maxIndex, Math.max(0, Math.round(x / liveRailItemSpan)));
                        setActiveLiveRailIndex(nextIndex);
                      }}
                    >
                      {sortedLeagues.map((league, idx) => {
                        const leagueId = String(league.id);
                        return (
                          <View key={`live-rail-${leagueId}`} style={{ marginRight: idx === sortedLeagues.length - 1 ? 0 : liveRailGap }}>
                            <MiniLeagueLiveCard
                              leagueId={leagueId}
                              leagueName={String(league.name ?? '')}
                              leagueAvatar={typeof league.avatar === 'string' ? league.avatar : null}
                              gw={viewingGw as number}
                              width={liveCardWidth}
                              enabled={idx < 4}
                              onPress={() =>
                                navigation.navigate(
                                  'LeagueDetail',
                                  { leagueId: league.id, name: league.name } satisfies RootStackParamList['LeagueDetail']
                                )
                              }
                            />
                          </View>
                        );
                      })}
                    </ScrollView>
                    <CarouselDots
                      progress={liveRailProgress}
                      count={sortedLeagues.length}
                      currentIndex={activeLiveRailIndex}
                      carouselName="Mini league live tables"
                      style={{ marginTop: 10 }}
                      onPress={(pageIndex) => {
                        const maxIndex = Math.max(0, sortedLeagues.length - 1);
                        const safeIndex = Math.min(maxIndex, Math.max(0, pageIndex));
                        setActiveLiveRailIndex(safeIndex);
                        liveRailProgress.value = safeIndex;
                        liveRailRef.current?.scrollTo({ x: safeIndex * liveRailItemSpan, animated: true });
                      }}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
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
          showListView && !isLoading && !error ? (
            <Card>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                No leagues yet
              </TotlText>
              <TotlText variant="muted">Once you join or create one, it’ll show up here.</TotlText>
            </Card>
          ) : null
        }
        ListFooterComponent={
          showListView && (data?.leagues?.length ?? 0) > 0 ? (
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
              currentGw={currentGw}
              meId={meId ?? null}
              fallbackMeId={unreadMeId ?? null}
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

