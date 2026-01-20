import React from 'react';
import { FlatList, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';

export default function LeaguesScreen() {
  const navigation = useNavigation<any>();
  const t = useTokens();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  return (
    <Screen fullBleed>
      <TotlText variant="heading" style={{ paddingHorizontal: t.space[4], marginBottom: 8 }}>
        Leagues
      </TotlText>

      <FlatList
        data={data?.leagues ?? []}
        style={{ flex: 1 }}
        keyExtractor={(l: any) => l.id}
        contentContainerStyle={{ padding: t.space[4], paddingBottom: t.space[8] }}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <>
            {isLoading && <TotlText variant="muted">Loading…</TotlText>}
            {error && (
              <Card style={{ marginBottom: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load leagues
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
                No leagues yet
              </TotlText>
              <TotlText variant="muted">Once you join or create one, it’ll show up here.</TotlText>
            </Card>
          ) : null
        }
        renderItem={({ item }: any) => (
          <Pressable
            onPress={() =>
              navigation.navigate(
                'LeagueDetail',
                { leagueId: item.id, name: item.name } satisfies LeaguesStackParamList['LeagueDetail']
              )
            }
          >
            <Card style={{ marginBottom: 10 }}>
              <TotlText variant="heading">{item.name}</TotlText>
              <TotlText variant="caption">Code: {item.code}</TotlText>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

