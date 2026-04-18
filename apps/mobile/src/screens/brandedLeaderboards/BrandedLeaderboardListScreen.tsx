import React from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Screen, TotlText, useTokens } from '@totl/ui';
import { api } from '../../lib/api';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import type { BrandedLeaderboardManageItem, BrandedLeaderboardMyItem } from '@totl/domain';
import AppTopHeader from '../../components/AppTopHeader';

export default function BrandedLeaderboardListScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<any>();
  const t = useTokens();
  const queryClient = useQueryClient();
  const { data: profileSummary } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });
  const avatarUrl = profileSummary?.avatar_url ?? null;
  const handleJoin = React.useCallback(() => {
    navigation.navigate('JoinLeaderboard', {});
  }, [navigation]);

  React.useLayoutEffect(() => {
    if (embedded) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleJoin}
          accessibilityRole="button"
          accessibilityLabel="Join leaderboard"
          hitSlop={10}
          style={({ pressed }) => ({
            paddingHorizontal: 8,
            paddingVertical: 4,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <TotlText style={{ color: t.color.brand, fontWeight: '800', fontSize: 16 }}>Join</TotlText>
        </Pressable>
      ),
    });
  }, [embedded, handleJoin, navigation, t.color.brand]);

  const mineQuery = useQuery({
    queryKey: ['branded-leaderboards-mine'],
    queryFn: () => api.getMyBrandedLeaderboards(),
    staleTime: 60_000,
    enabled: embedded,
  });

  const manageQuery = useQuery({
    queryKey: ['branded-leaderboards-manage'],
    queryFn: () => api.getManagedBrandedLeaderboards(),
    staleTime: 60_000,
    enabled: !embedded,
  });

  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const activeItems: BrandedLeaderboardMyItem[] = mineQuery.data?.leaderboards ?? [];
  const managedActiveItems: BrandedLeaderboardManageItem[] = manageQuery.data?.active ?? [];
  const restorableItems: BrandedLeaderboardManageItem[] = manageQuery.data?.restorable ?? [];
  const isLoading = embedded ? mineQuery.isLoading : manageQuery.isLoading;
  const refetch = embedded ? mineQuery.refetch : manageQuery.refetch;

  const handleRestore = React.useCallback(
    async (item: BrandedLeaderboardManageItem) => {
      try {
        setRestoringId(item.leaderboard.id);
        await api.restoreBrandedLeaderboard(item.leaderboard.id);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['branded-leaderboards-mine'] }),
          queryClient.invalidateQueries({ queryKey: ['branded-leaderboards-manage'] }),
        ]);
      } catch (err: any) {
        Alert.alert('Could not restore', err?.message ?? 'Please try again.');
      } finally {
        setRestoringId(null);
      }
    },
    [queryClient]
  );

  if (isLoading) {
    return (
      <Screen>
        <CenteredSpinner loading />
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      {embedded ? (
        <AppTopHeader
          onPressChat={() => navigation.navigate('ChatHub')}
          onPressProfile={() => navigation.navigate('Profile')}
          avatarUrl={avatarUrl}
          title="Leaderboards"
          embedded
          hideChat
          rightAction={
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
          }
        />
      ) : null}
      {embedded ? (
        <FlatList
          data={activeItems}
          keyExtractor={(item) => item.leaderboard.id}
          refreshControl={<TotlRefreshControl refreshing={false} onRefresh={() => refetch()} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 100,
            flexGrow: activeItems.length ? 0 : 1,
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 24, alignItems: 'center' }}>
              <TotlText variant="muted">No leaderboards yet</TotlText>
              <TotlText variant="muted" style={{ marginTop: 4, fontSize: 13 }}>
                Join a leaderboard to get started
              </TotlText>
              <Button title="Join a leaderboard" onPress={handleJoin} style={{ marginTop: 16, minWidth: 220 }} />
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <LeaderboardCard
              item={item}
              onPress={() =>
                navigation.navigate('BrandedLeaderboard', {
                  idOrSlug: item.leaderboard.id,
                })
              }
            />
          )}
        />
      ) : (
        <ScrollView
          refreshControl={<TotlRefreshControl refreshing={false} onRefresh={() => refetch()} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, flexGrow: 1 }}
        >
          <LeaderboardSection
            title="Active"
            description="Leaderboards currently shown in your branded tab."
            items={managedActiveItems}
            emptyLabel="No active branded leaderboards."
            onPressItem={(item) =>
              navigation.navigate('BrandedLeaderboard', {
                idOrSlug: item.leaderboard.id,
              })
            }
          />
          <View style={{ height: 24 }} />
          <LeaderboardSection
            title="Restorable"
            description="Leaderboards you've removed but can add back without rejoining from scratch."
            items={restorableItems}
            emptyLabel="No restorable branded leaderboards."
            onRestore={handleRestore}
            restoringId={restoringId}
          />
          {managedActiveItems.length === 0 && restorableItems.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 32, alignItems: 'center' }}>
              <TotlText variant="muted">No branded leaderboards yet</TotlText>
              <TotlText variant="muted" style={{ marginTop: 4, fontSize: 13, textAlign: 'center' }}>
                Join a leaderboard to get started, then manage it here later.
              </TotlText>
              <Button title="Join a leaderboard" onPress={handleJoin} style={{ marginTop: 16, minWidth: 220 }} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function LeaderboardSection({
  title,
  description,
  items,
  emptyLabel,
  onPressItem,
  onRestore,
  restoringId,
}: {
  title: string;
  description: string;
  items: Array<BrandedLeaderboardMyItem | BrandedLeaderboardManageItem>;
  emptyLabel: string;
  onPressItem?: (item: BrandedLeaderboardMyItem | BrandedLeaderboardManageItem) => void;
  onRestore?: (item: BrandedLeaderboardManageItem) => void;
  restoringId?: string | null;
}) {
  return (
    <View>
      <TotlText style={{ fontSize: 18, fontWeight: '800' }}>{title}</TotlText>
      <TotlText variant="muted" style={{ marginTop: 4, fontSize: 13 }}>
        {description}
      </TotlText>
      <View style={{ height: 12 }} />
      {items.length === 0 ? (
        <View style={{ paddingVertical: 12 }}>
          <TotlText variant="muted">{emptyLabel}</TotlText>
        </View>
      ) : (
        items.map((item, index) => (
          <View key={item.leaderboard.id} style={{ marginBottom: index === items.length - 1 ? 0 : 12 }}>
            <LeaderboardCard
              item={item}
              onPress={onPressItem ? () => onPressItem(item) : undefined}
              footer={
                onRestore && 'can_restore' in item && item.can_restore ? (
                  <Pressable
                    onPress={() => onRestore(item as BrandedLeaderboardManageItem)}
                    style={({ pressed }) => ({
                      marginTop: 12,
                      alignSelf: 'flex-start',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: pressed ? '#156f64' : '#1C8376',
                      opacity: restoringId === item.leaderboard.id ? 0.7 : 1,
                    })}
                    disabled={restoringId === item.leaderboard.id}
                  >
                    <TotlText style={{ color: '#fff', fontWeight: '700' }}>
                      {restoringId === item.leaderboard.id ? 'Restoring...' : 'Restore'}
                    </TotlText>
                  </Pressable>
                ) : null
              }
              statusLabel={'can_restore' in item && item.can_restore ? 'Removed from tab' : undefined}
            />
          </View>
        ))
      )}
    </View>
  );
}

function LeaderboardCard({
  item,
  onPress,
  footer,
  statusLabel,
}: {
  item: BrandedLeaderboardMyItem | BrandedLeaderboardManageItem;
  onPress?: () => void;
  footer?: React.JSX.Element | null;
  statusLabel?: string;
}) {
  const t = useTokens();
  const lb = item.leaderboard;
  const Container = onPress ? Pressable : View;

  return (
    <Container
      {...(onPress ? { onPress } : {})}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      {lb.header_image_url && (
        <Image
          source={{ uri: lb.header_image_url }}
          style={{ width: '100%', height: 100, backgroundColor: t.color.surface2 }}
          resizeMode="cover"
        />
      )}
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TotlText style={{ fontSize: 16, fontWeight: '700', color: t.color.text, flex: 1 }} numberOfLines={1}>
            {lb.display_name}
          </TotlText>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
              backgroundColor: lb.price_type === 'paid' ? '#7C3AED' : t.color.surface2,
            }}
          >
            <TotlText
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: lb.price_type === 'paid' ? '#fff' : t.color.muted,
              }}
            >
              {lb.price_type === 'paid'
                ? `${(lb.season_price_cents / 100).toFixed(2)} ${lb.currency}`
                : 'Free'}
            </TotlText>
          </View>
        </View>
        {item.subscription && (
          <TotlText style={{ fontSize: 12, color: t.color.muted, marginTop: 4 }}>
            {item.subscription.status === 'active'
              ? 'Active subscription'
              : `Subscription ${item.subscription.status}`}
          </TotlText>
        )}
        {statusLabel ? (
          <TotlText style={{ fontSize: 12, color: t.color.muted, marginTop: 4 }}>{statusLabel}</TotlText>
        ) : null}
        {footer}
      </View>
    </Container>
  );
}
