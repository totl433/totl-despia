import React from 'react';
import { FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';

export default function GlobalScreen() {
  const t = useTokens();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['leaderboard', 'overall'],
    queryFn: () => api.getOverallLeaderboard(),
  });

  return (
    <Screen fullBleed>
      <TotlText variant="heading" style={{ paddingHorizontal: t.space[4], marginBottom: 8 }}>
        Global
      </TotlText>

      <FlatList
        data={data?.rows ?? []}
        style={{ flex: 1 }}
        keyExtractor={(r: any) => r.user_id}
        contentContainerStyle={{ padding: t.space[4], paddingBottom: t.space[8] }}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <>
            {isLoading && <TotlText variant="muted">Loading…</TotlText>}
            {error && (
              <Card style={{ marginBottom: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load leaderboard
                </TotlText>
                <TotlText variant="muted">{(error as any)?.message ?? 'Unknown error'}</TotlText>
              </Card>
            )}
          </>
        }
        ListEmptyComponent={
          !isLoading && !error ? (
            <Card>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                No rows yet
              </TotlText>
              <TotlText variant="muted">Pull to refresh.</TotlText>
            </Card>
          ) : null
        }
        renderItem={({ item, index }: any) => (
          <Card style={{ marginBottom: 10 }}>
            <TotlText variant="heading">
              {index + 1}. {item.name ?? 'User'}
            </TotlText>
            <TotlText variant="caption">OCP: {item.ocp ?? 0}</TotlText>
          </Card>
        )}
      />
    </Screen>
  );
}

