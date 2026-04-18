import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
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
import UnderlineTabs from '../../components/UnderlineTabs';
import { useBrandedLeaderboardBroadcast } from '../../hooks/useBrandedLeaderboardBroadcast';
import { TotlRefreshControl } from '../../lib/refreshControl';
import LeagueOverflowMenu from '../../components/league/LeagueOverflowMenu';

type ScopeTab = 'gw' | 'month' | 'season';
type ViewTab = 'leaderboard' | 'broadcast';
const SCOPE_VALUES: ScopeTab[] = ['gw', 'month', 'season'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getScopeLabels(season: string | undefined): string[] {
  const monthLabel = MONTH_NAMES[new Date().getMonth()];
  const seasonLabel = season ?? '25/26';
  return [`GW`, monthLabel, seasonLabel];
}

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
  const { data: profileSummary } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });
  const avatarUrl = profileSummary?.avatar_url ?? null;
  const handleJoin = useCallback(() => {
    (navigation as any).navigate('JoinLeaderboard', {});
  }, [navigation]);

  const { detail, accessState, loading: accessLoading, error, refresh } = useLeaderboardAccess(idOrSlug);
  const [scope, setScope] = useState<ScopeTab>('gw');
  const [viewTab, setViewTab] = useState<ViewTab>('leaderboard');
  const scopeLabels = useMemo(() => getScopeLabels(detail?.leaderboard.season), [detail]);
  const [userId, setUserId] = useState<string | null>(null);
  const [paywallDismissed, setPaywallDismissed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

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

  const handleRefresh = useCallback(async () => {
    await refresh();
    if (showStandings) await refetchStandings();
  }, [refresh, refetchStandings, showStandings]);

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
      <View style={{ flex: 1 }}>
        {viewTab === 'broadcast' && canAccessBroadcast ? (
          <View style={{ flex: 1 }}>
            <BrandedLeaderboardHeader
              imageUrl={detail.leaderboard.header_image_url}
              displayName={detail.leaderboard.display_name}
            />
            <UnderlineTabs items={topLevelTabs} value={viewTab} onChange={setViewTab} />
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
            />
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

            {showStandings && (
              <View>
                <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <SegmentedControl
                    values={scopeLabels}
                    selectedIndex={SCOPE_VALUES.indexOf(scope)}
                    onChange={(e) => {
                      const idx = e.nativeEvent.selectedSegmentIndex;
                      setScope(SCOPE_VALUES[idx]);
                    }}
                  />
                </View>

                <View style={{ overflow: 'hidden' }}>
                  {standingsLoading ? (
                    <View style={{ paddingVertical: 40 }}>
                      <ActivityIndicator />
                    </View>
                  ) : displayRows.length > 0 ? (
                    <BrandedLeaderboardTable
                      rows={displayRows}
                      highlightUserId={isPaywalled ? null : userId}
                      valueLabel="Pts"
                    />
                  ) : null}

                  {isPaywalled && (
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
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        )}

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
