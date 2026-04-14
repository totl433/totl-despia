import React from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Button, Screen, TotlText, useTokens } from '@totl/ui';
import { api } from '../../lib/api';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import type { BrandedLeaderboardMyItem } from '@totl/domain';
import AppTopHeader from '../../components/AppTopHeader';

export default function BrandedLeaderboardListScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<any>();
  const t = useTokens();
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['branded-leaderboards-mine'],
    queryFn: () => api.getMyBrandedLeaderboards(),
    staleTime: 60_000,
  });

  const items = data?.leaderboards ?? [];

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
      <FlatList
        data={items}
        keyExtractor={(item) => item.leaderboard.id}
        refreshControl={<TotlRefreshControl refreshing={false} onRefresh={() => refetch()} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, flexGrow: items.length ? 0 : 1 }}
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
    </Screen>
  );
}

function LeaderboardCard({
  item,
  onPress,
}: {
  item: BrandedLeaderboardMyItem;
  onPress: () => void;
}) {
  const t = useTokens();
  const lb = item.leaderboard;

  return (
    <Pressable
      onPress={onPress}
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
      </View>
    </Pressable>
  );
}
