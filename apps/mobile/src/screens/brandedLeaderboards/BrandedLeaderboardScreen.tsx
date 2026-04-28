import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Pressable, ScrollView, View } from 'react-native';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, TotlText, useTokens } from '@totl/ui';
import { useLeaderboardAccess } from '../../hooks/useLeaderboardAccess';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import BrandedLeaderboardHeader from '../../components/brandedLeaderboards/BrandedLeaderboardHeader';
import BrandedLeaderboardBroadcastTab from '../../components/brandedLeaderboards/BrandedLeaderboardBroadcastTab';
import BrandedLeaderboardTable from '../../components/brandedLeaderboards/BrandedLeaderboardTable';
import BrandedLeaderboardPaywall from '../../components/brandedLeaderboards/BrandedLeaderboardPaywall';
import AppTopHeader from '../../components/AppTopHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import SegmentedPillControl from '../../components/SegmentedPillControl';
import UnderlineTabs from '../../components/UnderlineTabs';
import { useBrandedLeaderboardBroadcast } from '../../hooks/useBrandedLeaderboardBroadcast';
import { TotlRefreshControl } from '../../lib/refreshControl';
import LeagueOverflowMenu from '../../components/league/LeagueOverflowMenu';
import { getEffectiveCurrentMonthKey, getMonthAllocations, type MonthAllocation } from '../../lib/leaderboardMonths';

type ScopeTab = 'gw' | 'month' | 'season';
type ViewTab = 'leaderboard' | 'broadcast';
type FilterMode = 'all' | 'friends';
type FormScope = 'none' | 'last5' | 'last10' | 'sinceStarted';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PLACEHOLDER_NAMES = [
  'Demetrius Howell', 'Esmeralda Herman', 'Randy Windler',
  'Amelia Carter', 'Jackson Rivera', 'Sofia Nguyen',
  'Liam Patel', 'Olivia Thompson', 'Noah Williams',
  'Emma Garcia', 'Aiden Martinez', 'Isabella Brown',
  'Lucas Johnson', 'Mia Anderson', 'Ethan Taylor',
];

function generatePlaceholderRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    rank: i + 1,
    user_id: `placeholder-${i}`,
    name: PLACEHOLDER_NAMES[i % PLACEHOLDER_NAMES.length],
    avatar_url: null,
    value: Math.max(0, 120 - Math.floor(i * 3.5) + Math.floor(Math.random() * 5)),
    is_host: i < 2,
  }));
}

export default function BrandedLeaderboardScreen({
  idOrSlugOverride,
  hideBackButton = false,
}: {
  idOrSlugOverride?: string;
  hideBackButton?: boolean;
}) {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const t = useTokens();
  const queryClient = useQueryClient();
  const idOrSlug: string = idOrSlugOverride ?? route.params?.idOrSlug ?? route.params?.id ?? '';
  const pendingJoinCode: string | undefined = route.params?.joinCode;
  const requestedInitialTab: ViewTab | undefined =
    route.params?.initialTab === 'broadcast'
      ? 'broadcast'
      : route.params?.initialTab === 'leaderboard'
        ? 'leaderboard'
        : undefined;
  const { data: profileSummary } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });
  const { data: homeSnapshot } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
    staleTime: 60_000,
  });
  const avatarUrl = profileSummary?.avatar_url ?? null;
  const handleJoin = useCallback(() => {
    (navigation as any).navigate('JoinLeaderboard', {});
  }, [navigation]);

  const { detail, accessState, loading: accessLoading, error, refresh } = useLeaderboardAccess(idOrSlug);
  const [scope, setScope] = useState<ScopeTab>('gw');
  const [viewTab, setViewTab] = useState<ViewTab>(requestedInitialTab === 'broadcast' ? 'broadcast' : 'leaderboard');
  const [userId, setUserId] = useState<string | null>(null);
  const [paywallDismissed, setPaywallDismissed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [formScope, setFormScope] = useState<FormScope>('none');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterMenuPosition, setFilterMenuPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false);
  const [calendarMenuPosition, setCalendarMenuPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [monthMenuPosition, setMonthMenuPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [broadcastSectionY, setBroadcastSectionY] = useState(0);
  const [broadcastTabY, setBroadcastTabY] = useState(0);
  const filterIconRef = useRef<View>(null);
  const calendarIconRef = useRef<View>(null);
  const monthMenuRef = useRef<View>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  const headerTitle = detail?.leaderboard.display_name ?? 'Leaderboard';

  const showStandings =
    accessState === 'free_access' ||
    accessState === 'full_access' ||
    accessState === 'paywall_required';

  const isPaywalled = accessState === 'paywall_required';
  const showPaywallSheet = isPaywalled && !paywallDismissed;
  const canAccessBroadcast = Boolean(detail && (detail.hasAccess || detail.canPostBroadcast));
  const hasActiveMembership = Boolean(detail?.membership && !detail.membership.left_at);
  const activeGw =
    typeof homeSnapshot?.viewingGw === 'number'
      ? homeSnapshot.viewingGw
      : typeof homeSnapshot?.currentGw === 'number'
        ? homeSnapshot.currentGw
        : null;
  const currentMonthLabel = MONTH_NAMES[new Date().getMonth()] ?? 'Month';
  const currentGwIsLive = Boolean(
    homeSnapshot?.liveScores?.some((score) => score?.status === 'IN_PLAY' || score?.status === 'PAUSED')
  );
  const {
    data: friendIds,
    isLoading: friendsLoading,
    refetch: refetchFriendIds,
  } = useQuery({
    queryKey: ['branded-leaderboard', 'miniLeagueFriendIds'],
    enabled: filterMode === 'friends' && !!userId,
    queryFn: async () => {
      const { leagues } = await api.listLeagues();
      const ids = new Set<string>();
      if (userId) ids.add(userId);
      const details = await Promise.all(leagues.map((league) => api.getLeague(String(league.id))));
      details.forEach((league) => league.members.forEach((member) => ids.add(String(member.id))));
      return ids;
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: firstSubmissionGw } = useQuery<number | null>({
    enabled: !!userId && scope === 'season',
    queryKey: ['branded-leaderboard', 'firstSubmissionGw', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_gw_submissions')
        .select('gw')
        .eq('user_id', userId)
        .order('gw', { ascending: true })
        .limit(1);
      if (error) throw error;
      const first = (data ?? [])[0] as { gw?: number } | undefined;
      return first?.gw != null ? Number(first.gw) : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: standings,
    isLoading: standingsLoading,
    refetch: refetchStandings,
  } = useQuery({
    queryKey: ['branded-leaderboard-standings', detail?.leaderboard.id, scope],
    queryFn: () => api.getBrandedLeaderboardStandings(detail!.leaderboard.id, { scope }),
    enabled: !!detail && showStandings,
    staleTime: 30_000,
  });

  const {
    messages: broadcastMessages,
    unreadCount: broadcastUnreadCount,
    isLoading: broadcastLoading,
    error: broadcastError,
    sendMessage: sendBroadcastMessage,
    setLastReadAt: setBroadcastLastReadAt,
  } = useBrandedLeaderboardBroadcast({
    leaderboardId: detail?.leaderboard.id ?? null,
    enabled: canAccessBroadcast,
    userId,
    senderName: profileSummary?.name ?? null,
    senderAvatarUrl: avatarUrl,
  });

  useEffect(() => {
    if (!canAccessBroadcast && viewTab === 'broadcast') {
      setViewTab('leaderboard');
    }
  }, [canAccessBroadcast, viewTab]);

  useEffect(() => {
    if (!requestedInitialTab) return;
    if (requestedInitialTab === 'broadcast' && !canAccessBroadcast) return;
    setViewTab(requestedInitialTab);
  }, [canAccessBroadcast, requestedInitialTab]);

  const placeholderRows = useMemo(() => generatePlaceholderRows(15), []);
  const topLevelTabs = useMemo(
    () =>
      canAccessBroadcast
        ? [
            { key: 'leaderboard' as const, label: 'Leaderboard' },
            { key: 'broadcast' as const, label: 'Broadcast', unreadCount: broadcastLoading ? detail?.broadcastUnreadCount ?? 0 : broadcastUnreadCount },
          ]
        : [],
    [broadcastLoading, broadcastUnreadCount, canAccessBroadcast, detail?.broadcastUnreadCount]
  );

  const displayRows = useMemo(() => {
    if (standings?.rows && standings.rows.length > 0) return standings.rows;
    if (isPaywalled) return placeholderRows;
    return [];
  }, [standings, isPaywalled, placeholderRows]);
  const visibleUserIds = useMemo(
    () => Array.from(new Set(displayRows.map((row) => String(row.user_id)).filter(Boolean))),
    [displayRows]
  );
  const { data: allGwPointsRows } = useQuery({
    queryKey: ['branded-leaderboard-all-points', detail?.leaderboard.id, activeGw, visibleUserIds.join(',')],
    enabled: !!detail && showStandings && !isPaywalled && visibleUserIds.length > 0 && activeGw != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_v_gw_points')
        .select('user_id, gw, points')
        .in('user_id', visibleUserIds)
        .in(
          'gw',
          Array.from({ length: activeGw as number }, (_, index) => index + 1)
        );
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; gw: number; points: number | null }>;
    },
    staleTime: 30_000,
  });

  const metadataByUserId = useMemo(() => {
    const map = new Map<string, (typeof displayRows)[number]>();
    displayRows.forEach((row) => map.set(String(row.user_id), row));
    return map;
  }, [displayRows]);

  const filterRows = useCallback(
    (rows: typeof displayRows) => {
      if (filterMode !== 'friends') return rows;
      if (!friendIds) return [];
      return rows.filter((row) => friendIds.has(String(row.user_id)));
    },
    [filterMode, friendIds]
  );

  const currentMonthKey = useMemo(
    () => getEffectiveCurrentMonthKey(activeGw ?? null, { hasActiveLiveGames: currentGwIsLive }) ?? null,
    [activeGw, currentGwIsLive]
  );

  const selectedMonth = useMemo<MonthAllocation | null>(() => {
    const monthKey = selectedMonthKey ?? currentMonthKey;
    return monthKey ? getMonthAllocations().find((month) => month.monthKey === monthKey) ?? null : null;
  }, [currentMonthKey, selectedMonthKey]);

  const computedRows = useMemo(() => {
    if (!activeGw || displayRows.length === 0) return displayRows;
    const pointsByUser = new Map<string, Map<number, number>>();
    (allGwPointsRows ?? []).forEach((row) => {
      const userId = String(row.user_id);
      if (!pointsByUser.has(userId)) pointsByUser.set(userId, new Map<number, number>());
      pointsByUser.get(userId)!.set(Number(row.gw), Number(row.points ?? 0));
    });

    const allRows = visibleUserIds.map((userId) => {
      const meta = metadataByUserId.get(userId);
      return {
        rank: 0,
        user_id: userId,
        name: meta?.name ?? 'User',
        avatar_url: meta?.avatar_url ?? null,
        is_host: meta?.is_host ?? false,
        value: 0,
        compact_values: undefined as Array<number | null> | undefined,
      };
    });

    const sortRows = (rows: typeof allRows) =>
      [...rows]
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
        .map((row, index) => ({ ...row, rank: index + 1 }));

    if (scope === 'gw') {
      return filterRows(
        sortRows(
          allRows.map((row) => ({
            ...row,
            value: pointsByUser.get(String(row.user_id))?.get(activeGw) ?? 0,
          }))
        )
      );
    }

    if (scope === 'month' && selectedMonth) {
      const monthGws = Array.from(
        { length: selectedMonth.endGw - selectedMonth.startGw + 1 },
        (_, index) => selectedMonth.startGw + index
      );
      return filterRows(
        sortRows(
          allRows.map((row) => {
            const compactValues = monthGws.map((gw) => pointsByUser.get(String(row.user_id))?.get(gw) ?? null);
            return {
              ...row,
              value: compactValues.reduce((sum, points) => sum + Number(points ?? 0), 0),
              compact_values: compactValues,
            };
          })
        )
      );
    }

    if (scope === 'season' && formScope !== 'none') {
      const endGw = activeGw;
      const startGw =
        formScope === 'last5'
          ? Math.max(1, endGw - 4)
          : formScope === 'last10'
            ? Math.max(1, endGw - 9)
            : firstSubmissionGw ?? 1;
      const requiredWeeks = endGw - startGw + 1;
      return filterRows(
        sortRows(
          allRows
            .map((row) => {
              const compactValues = Array.from({ length: requiredWeeks }, (_, index) =>
                pointsByUser.get(String(row.user_id))?.get(startGw + index) ?? null
              );
              const played = compactValues.filter((value) => value != null).length;
              return {
                ...row,
                value: compactValues.reduce((sum, points) => sum + Number(points ?? 0), 0),
                compact_values: [pointsByUser.get(String(row.user_id))?.get(activeGw) ?? null],
                played,
              };
            })
            .filter((row) => row.played === requiredWeeks)
            .map(({ played, ...row }) => row)
        )
      );
    }

    return filterRows(
      sortRows(
        allRows.map((row) => {
          const allGwValues = Array.from({ length: activeGw }, (_, index) =>
            pointsByUser.get(String(row.user_id))?.get(index + 1) ?? null
          );
          return {
            ...row,
            value: allGwValues.reduce((sum, points) => sum + Number(points ?? 0), 0),
            compact_values: [pointsByUser.get(String(row.user_id))?.get(activeGw) ?? null],
          };
        })
      )
    );
  }, [
    activeGw,
    allGwPointsRows,
    displayRows,
    filterRows,
    firstSubmissionGw,
    formScope,
    metadataByUserId,
    scope,
    selectedMonth,
    visibleUserIds,
  ]);

  const standingsTabValue = useMemo(() => {
    if (scope === 'month') return 'monthly' as const;
    if (scope === 'season') return 'overall' as const;
    return 'gw' as const;
  }, [scope]);

  const standingsSubtitle = useMemo(() => {
    const who = filterMode === 'friends' ? 'Mini League Friends' : 'All Players';
    if (scope === 'season' && formScope === 'none') return `${who} since the start of the season`;
    if (scope === 'season' && formScope === 'last5') return `${who} • Last 5 GWs`;
    if (scope === 'season' && formScope === 'last10') return `${who} • Last 10 GWs`;
    if (scope === 'season' && formScope === 'sinceStarted') {
      return firstSubmissionGw != null ? `${who} since GW${firstSubmissionGw}` : `${who} (submit to see)`;
    }
    if (scope === 'gw') {
      return activeGw != null
        ? `${who} who submitted for GW${activeGw}`
        : `${who} in this leaderboard`;
    }
    return '';
  }, [activeGw, filterMode, firstSubmissionGw, formScope, scope]);

  const monthRangeLabel = useMemo(() => {
    if (scope !== 'month' || !selectedMonth) return '';
    return `GW${selectedMonth.startGw}\u2013${selectedMonth.endGw}`;
  }, [scope, selectedMonth]);

  const standingsValueLabel = useMemo(() => {
    if (scope === 'gw') return activeGw != null ? `GW${activeGw}` : 'GW';
    if (scope === 'season' && formScope === 'none') return 'OCP';
    return 'PTS';
  }, [activeGw, formScope, scope]);

  const currentBrandedMonthLabel = useMemo(() => {
    const month = selectedMonth ?? (currentMonthKey ? getMonthAllocations().find((item) => item.monthKey === currentMonthKey) : null);
    return month ? month.label.split(' ')[0] : currentMonthLabel;
  }, [currentMonthKey, currentMonthLabel, selectedMonth]);
  const standingsTabItems = useMemo(
    () => [
      { key: 'gw' as const, label: 'GW' },
      { key: 'monthly' as const, label: currentBrandedMonthLabel },
      { key: 'overall' as const, label: 'Overall' },
    ],
    [currentBrandedMonthLabel]
  );

  const monthlyCompactValueLabels = useMemo(() => {
    if (scope !== 'month' || !selectedMonth) return undefined;
    return Array.from(
      { length: selectedMonth.endGw - selectedMonth.startGw + 1 },
      (_, index) => String(selectedMonth.startGw + index)
    );
  }, [scope, selectedMonth]);

  const monthlyWinnerUserIds = useMemo(() => {
    if (scope !== 'month' || computedRows.length === 0 || !selectedMonth) return [] as string[];
    if (activeGw != null && activeGw <= selectedMonth.endGw) return [] as string[];
    const topValue = computedRows[0]?.value ?? null;
    if (topValue == null) return [] as string[];
    return computedRows.filter((row) => row.value === topValue).map((row) => row.user_id);
  }, [activeGw, computedRows, scope, selectedMonth]);

  const selectableMonths = useMemo(() => {
    if (activeGw == null) return [] as MonthAllocation[];
    return getMonthAllocations().filter((month) => month.startGw <= activeGw).reverse();
  }, [activeGw]);

  const handleRefresh = useCallback(async () => {
    await refresh();
    if (showStandings) await refetchStandings();
    if (filterMode === 'friends') await refetchFriendIds();
    await queryClient.invalidateQueries({ queryKey: ['branded-leaderboard-all-points', detail?.leaderboard.id] });
  }, [detail?.leaderboard.id, filterMode, queryClient, refresh, refetchFriendIds, refetchStandings, showStandings]);

  const handleLeave = useCallback(async () => {
    if (!detail || leaving) return;
    try {
      setLeaving(true);
      await api.leaveBrandedLeaderboard(detail.leaderboard.id);
      const remaining = await api.getMyBrandedLeaderboards();
      queryClient.setQueryData(['branded-leaderboards-mine'], remaining);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branded-leaderboards-mine'] }),
        queryClient.invalidateQueries({ queryKey: ['branded-leaderboards-manage'] }),
        queryClient.invalidateQueries({ queryKey: ['branded-leaderboard-standings', detail.leaderboard.id] }),
      ]);
      const nextTab = remaining.leaderboards.length > 0 ? 'BrandedLeaderboards' : 'Predictions';
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Tabs', params: { screen: nextTab } }],
        })
      );
    } catch (err: any) {
      Alert.alert('Could not leave', err?.message ?? 'Failed to leave leaderboard. Please try again.');
    } finally {
      setLeaving(false);
    }
  }, [detail, leaving, navigation, queryClient]);

  const confirmLeave = useCallback(() => {
    setMenuOpen(false);
    Alert.alert(
      'Leave leaderboard',
      'Remove this leaderboard from your branded tab? You can restore it later in My Branded Leaderboards.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => void handleLeave() },
      ]
    );
  }, [handleLeave]);

  if (accessLoading) {
    return (
      <Screen>
        <CenteredSpinner loading />
      </Screen>
    );
  }

  if (error || !detail) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Oops
          </TotlText>
          <TotlText variant="muted" style={{ textAlign: 'center' }}>
            {error ?? 'Could not load leaderboard'}
          </TotlText>
          <Pressable
            onPress={refresh}
            style={{
              marginTop: 16,
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: '#1C8376',
              borderRadius: 8,
            }}
          >
            <TotlText style={{ color: '#fff', fontWeight: '600' }}>Retry</TotlText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      <AppTopHeader
        onPressProfile={() => (navigation as any).navigate('Profile')}
        onPressChat={() => (navigation as any).navigate('ChatHub')}
        avatarUrl={avatarUrl}
        title={headerTitle}
        hideProfile={!hideBackButton}
        hideChat
        rightAction={
          hasActiveMembership ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Leaderboard menu"
              disabled={leaving}
              style={({ pressed }) => ({
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: pressed || leaving ? 0.75 : 1,
              })}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={t.color.text} />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleJoin}
              accessibilityRole="button"
              accessibilityLabel="Join leaderboard"
              style={({ pressed }) => ({
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <TotlText style={{ color: t.color.brand, fontWeight: '800', fontSize: 16 }}>Join</TotlText>
            </Pressable>
          )
        }
        leftAction={
          hideBackButton ? undefined : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={22} color={t.color.text} />
            </Pressable>
          )
        }
        embedded
      />
      <LeagueOverflowMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAction={() => {}}
        extraItems={[
          {
            key: 'leave-branded-leaderboard',
            label: leaving ? 'Leaving...' : 'Leave leaderboard',
            icon: <Ionicons name="log-out-outline" size={18} color={t.color.danger} />,
            onPress: confirmLeave,
          },
        ]}
        showBadgeActions={false}
        showCoreActions={false}
        menuTextColor={t.color.text}
      />
      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          const nextY = Math.round(e.nativeEvent.layout.y);
          if (nextY !== broadcastSectionY) setBroadcastSectionY(nextY);
        }}
      >
        {viewTab === 'broadcast' && canAccessBroadcast ? (
          <View style={{ flex: 1 }}>
            <BrandedLeaderboardHeader
              imageUrl={detail.leaderboard.header_image_url}
              displayName={detail.leaderboard.display_name}
            />
            <UnderlineTabs items={topLevelTabs} value={viewTab} onChange={setViewTab} />
            <View
              style={{ flex: 1 }}
              onLayout={(e) => {
                const nextY = Math.round(e.nativeEvent.layout.y);
                if (nextY !== broadcastTabY) setBroadcastTabY(nextY);
              }}
            >
              <BrandedLeaderboardBroadcastTab
                leaderboardId={detail.leaderboard.id}
                currentUserId={userId}
                visible={viewTab === 'broadcast'}
                canPost={detail.canPostBroadcast}
                messages={broadcastMessages}
                isLoading={broadcastLoading}
                error={broadcastError}
                onSend={sendBroadcastMessage}
                setLastReadAt={setBroadcastLastReadAt}
                keyboardVerticalOffset={broadcastSectionY + broadcastTabY}
              />
            </View>
          </View>
        ) : showStandings ? (
          <View style={{ flex: 1, minHeight: 0 }}>
            <BrandedLeaderboardHeader
              imageUrl={detail.leaderboard.header_image_url}
              displayName={detail.leaderboard.display_name}
            />
            {canAccessBroadcast ? <UnderlineTabs items={topLevelTabs} value={viewTab} onChange={setViewTab} /> : null}

            <View style={{ flex: 1, minHeight: 0, paddingHorizontal: t.space[4] }}>
              <View style={{ marginTop: 12 }}>
                <SegmentedPillControl
                  items={standingsTabItems}
                  value={standingsTabValue}
                  onChange={(next) => {
                    setScope(next === 'monthly' ? 'month' : next === 'overall' ? 'season' : 'gw');
                    if (next !== 'overall') setFormScope('none');
                  }}
                  height={36}
                />
              </View>

              {scope === 'month' ? (
                <View style={{ marginTop: 22, marginBottom: 18, position: 'relative' }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <TotlText style={{ fontWeight: '900', fontSize: 20, lineHeight: 24, color: t.color.text }}>
                      Player of the Month{' '}
                    </TotlText>
                    {monthRangeLabel ? (
                      <TotlText
                        style={{
                          fontSize: 14,
                          lineHeight: 20,
                          color: t.color.text,
                        }}
                      >
                        ({monthRangeLabel})
                      </TotlText>
                    ) : null}
                  </View>
                  <View ref={monthMenuRef} collapsable={false} style={{ position: 'absolute', right: 0, top: 0 }}>
                    <Pressable
                      onPress={() => {
                        monthMenuRef.current?.measureInWindow((x, y, width, height) => {
                          setMonthMenuPosition({ x, y, width, height });
                          setMonthMenuOpen(true);
                        });
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        opacity: pressed ? 0.7 : 1,
                      })}
                      accessibilityLabel="Select month"
                      accessibilityRole="button"
                    >
                      <Ionicons name="calendar-outline" size={20} color={t.color.muted} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View
                  style={{
                    marginTop: 14,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <TotlText
                    variant="sectionSubtitle"
                    style={{ fontSize: 13, lineHeight: 18, flex: 1 }}
                    numberOfLines={1}
                  >
                    {standingsSubtitle}
                  </TotlText>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {scope === 'season' ? (
                      <View ref={calendarIconRef} collapsable={false} style={{ padding: 8, marginLeft: 4 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Form period"
                          onPress={() => {
                            calendarIconRef.current?.measureInWindow((x, y, width, height) => {
                              setCalendarMenuPosition({ x, y, width, height });
                              setCalendarMenuOpen(true);
                            });
                          }}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={formScope !== 'none' ? t.color.brand : t.color.muted}
                          />
                        </Pressable>
                      </View>
                    ) : null}
                    {(scope === 'gw' || scope === 'season') ? (
                      <View ref={filterIconRef} collapsable={false} style={{ padding: 8, marginLeft: 4 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Filter"
                          onPress={() => {
                            filterIconRef.current?.measureInWindow((x, y, width, height) => {
                              setFilterMenuPosition({ x, y, width, height });
                              setFilterMenuOpen(true);
                            });
                          }}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Ionicons name="funnel-outline" size={20} color={t.color.muted} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}

              {standingsLoading || friendsLoading ? (
                <View style={{ paddingVertical: 40 }}>
                  <ActivityIndicator />
                </View>
              ) : computedRows.length > 0 ? (
                <BrandedLeaderboardTable
                  rows={computedRows}
                  highlightUserId={isPaywalled ? null : userId}
                  valueLabel={standingsValueLabel}
                  secondaryValueLabel={scope === 'season' && formScope === 'none' && activeGw != null ? `GW${activeGw}` : undefined}
                  compactValueLabels={scope === 'month' ? monthlyCompactValueLabels : undefined}
                  compactLiveValueLabel={scope === 'month' && currentGwIsLive && activeGw != null ? String(activeGw) : undefined}
                  winnerUserIds={scope === 'month' ? monthlyWinnerUserIds : undefined}
                  style={{
                    flex: 1,
                    marginHorizontal: -t.space[4],
                    marginBottom: -24,
                  }}
                />
              ) : null}

              {isPaywalled ? (
                <BlurView
                  intensity={25}
                  tint="light"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
              ) : null}
            </View>
          </View>
        ) : (
          <ScrollView
            refreshControl={<TotlRefreshControl refreshing={false} onRefresh={handleRefresh} />}
            contentContainerStyle={{ paddingBottom: isPaywalled ? 320 : 100 }}
            scrollEnabled={!showPaywallSheet}
          >
            <BrandedLeaderboardHeader
              imageUrl={detail.leaderboard.header_image_url}
              displayName={detail.leaderboard.display_name}
            />
            {canAccessBroadcast ? <UnderlineTabs items={topLevelTabs} value={viewTab} onChange={setViewTab} /> : null}

            {accessState === 'not_joined' && (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <TotlText variant="heading" style={{ marginBottom: 8 }}>
                  Join this leaderboard
                </TotlText>
                <TotlText variant="muted" style={{ textAlign: 'center', marginBottom: 16 }}>
                  {detail.leaderboard.price_type === 'free' || !detail.requiresPurchase
                    ? 'Enter your join code to compete.'
                    : `Subscribe to compete — ${(detail.leaderboard.season_price_cents / 100).toFixed(2)} ${detail.leaderboard.currency}/season`}
                </TotlText>
                <Pressable
                  onPress={() => {
                    (navigation as any).navigate('JoinLeaderboard', {
                      leaderboardId: detail.leaderboard.id,
                      leaderboardName: detail.leaderboard.display_name,
                    });
                  }}
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    backgroundColor: '#1C8376',
                    borderRadius: 10,
                  }}
                >
                  <TotlText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Join</TotlText>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        <Modal
          visible={filterMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setFilterMenuOpen(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }}
              onPress={() => setFilterMenuOpen(false)}
            />
            {filterMenuPosition ? (
              <View
                style={{
                  position: 'absolute',
                  top: filterMenuPosition.y + filterMenuPosition.height + 4,
                  right: Dimensions.get('window').width - (filterMenuPosition.x + filterMenuPosition.width),
                  width: 200,
                  backgroundColor: t.color.surface,
                  borderRadius: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                  overflow: 'hidden',
                }}
              >
                <Pressable
                  onPress={() => {
                    setFilterMode('all');
                    setFilterMenuOpen(false);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    backgroundColor:
                      pressed ? 'rgba(0,0,0,0.05)' : filterMode === 'all' ? 'rgba(28,131,118,0.08)' : 'transparent',
                    borderBottomWidth: 1,
                    borderBottomColor: t.color.border,
                  })}
                >
                  <TotlText style={{ fontSize: 15, color: filterMode === 'all' ? t.color.brand : t.color.text }}>
                    All Players
                  </TotlText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setFilterMode('friends');
                    setFilterMenuOpen(false);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    backgroundColor:
                      pressed
                        ? 'rgba(0,0,0,0.05)'
                        : filterMode === 'friends'
                          ? 'rgba(28,131,118,0.08)'
                          : 'transparent',
                  })}
                >
                  <TotlText
                    style={{ fontSize: 15, color: filterMode === 'friends' ? t.color.brand : t.color.text }}
                  >
                    Mini League Friends
                  </TotlText>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Modal>

        <Modal
          visible={calendarMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCalendarMenuOpen(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }}
              onPress={() => setCalendarMenuOpen(false)}
            />
            {calendarMenuPosition ? (
              <View
                style={{
                  position: 'absolute',
                  top: calendarMenuPosition.y + calendarMenuPosition.height + 4,
                  right: Dimensions.get('window').width - (calendarMenuPosition.x + calendarMenuPosition.width),
                  width: 200,
                  backgroundColor: t.color.surface,
                  borderRadius: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                  overflow: 'hidden',
                }}
              >
                {[
                  { key: 'none', label: 'This season' },
                  { key: 'last5', label: 'Last 5 weeks' },
                  { key: 'last10', label: 'Last 10 weeks' },
                  { key: 'sinceStarted', label: 'Since Joined' },
                ].map((item, index, array) => (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      setFormScope(item.key as FormScope);
                      setCalendarMenuOpen(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      backgroundColor:
                        pressed
                          ? 'rgba(0,0,0,0.05)'
                          : formScope === item.key
                            ? 'rgba(28,131,118,0.08)'
                            : 'transparent',
                      ...(index < array.length - 1
                        ? { borderBottomWidth: 1, borderBottomColor: t.color.border }
                        : {}),
                    })}
                  >
                    <TotlText style={{ fontSize: 15, color: formScope === item.key ? t.color.brand : t.color.text }}>
                      {item.label}
                    </TotlText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </Modal>

        <Modal
          visible={monthMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMonthMenuOpen(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }}
              onPress={() => setMonthMenuOpen(false)}
            />
            {monthMenuPosition ? (
              <View
                style={{
                  position: 'absolute',
                  top: monthMenuPosition.y + monthMenuPosition.height + 4,
                  right: Dimensions.get('window').width - (monthMenuPosition.x + monthMenuPosition.width),
                  width: 200,
                  backgroundColor: t.color.surface,
                  borderRadius: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 8,
                  overflow: 'hidden',
                }}
              >
                <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {selectableMonths.map((month, index) => {
                    const isSelected = (selectedMonthKey ?? currentMonthKey) === month.monthKey;
                    const isLast = index === selectableMonths.length - 1;
                    return (
                      <Pressable
                        key={month.monthKey}
                        onPress={() => {
                          setSelectedMonthKey(month.monthKey);
                          setMonthMenuOpen(false);
                        }}
                        style={({ pressed }) => ({
                          paddingVertical: 14,
                          paddingHorizontal: 16,
                          backgroundColor: pressed ? 'rgba(0,0,0,0.05)' : 'transparent',
                          ...(!isLast ? { borderBottomWidth: 1, borderBottomColor: t.color.border } : {}),
                        })}
                      >
                        <TotlText style={{ fontSize: 15, color: isSelected ? t.color.brand : t.color.text }}>
                          {month.label}
                        </TotlText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </Modal>

        {/* Paywall sheet — floats at the bottom over content */}
        {showPaywallSheet && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <BrandedLeaderboardPaywall
              leaderboardId={detail.leaderboard.id}
              offeringId={detail.leaderboard.rc_offering_id}
              joinCode={pendingJoinCode}
              displayName={detail.leaderboard.display_name}
              description={detail.leaderboard.description}
              priceCents={detail.leaderboard.season_price_cents}
              currency={detail.leaderboard.currency}
              hostNames={detail.hosts.map((h) => h.name).filter(Boolean) as string[]}
              onSuccess={refresh}
              onDismiss={() => setPaywallDismissed(true)}
            />
          </View>
        )}

        {/* Floating subscribe button when paywall dismissed */}
        {isPaywalled && paywallDismissed && (
          <Pressable
            onPress={() => setPaywallDismissed(false)}
            style={({ pressed }) => ({
              position: 'absolute',
              bottom: 40,
              left: 24,
              right: 24,
              backgroundColor: '#000',
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
            })}
          >
            <TotlText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              Subscribe
            </TotlText>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}
