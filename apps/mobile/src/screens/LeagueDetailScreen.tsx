import React from 'react';
import { FlatList } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';

export default function LeagueDetailScreen() {
  const route = useRoute<any>();
  const params = route.params as LeaguesStackParamList['LeagueDetail'];
  const t = useTokens();

  const { data, isLoading } = useQuery({
    queryKey: ['league', params.leagueId],
    queryFn: () => api.getLeague(params.leagueId),
  });

  const { data: table } = useQuery({
    enabled: !!data,
    queryKey: ['leagueTable', params.leagueId, 'currentGw'],
    queryFn: async () => {
      const home = await api.getHomeSnapshot();
      return api.getLeagueGwTable(params.leagueId, home.viewingGw);
    },
  });

  return (
    <Screen fullBleed>
      <TotlText variant="heading" style={{ paddingHorizontal: t.space[4], marginBottom: 8 }}>
        {params.name}
      </TotlText>

      {isLoading && <TotlText variant="muted">Loading…</TotlText>}

      {table && (
        <Card style={{ marginHorizontal: t.space[4], marginBottom: 12 }}>
          <TotlText variant="heading" style={{ marginBottom: 6 }}>
            GW {table.gw} table
          </TotlText>
          <TotlText variant="muted">
            Submitted: {table.submittedCount}/{table.totalMembers}
          </TotlText>
        </Card>
      )}

      {table && (
        <>
          <TotlText variant="heading" style={{ paddingHorizontal: t.space[4], marginBottom: 8 }}>
            Standings
          </TotlText>
          <FlatList
            data={table.rows}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: t.space[4], paddingBottom: t.space[6] }}
            keyExtractor={(r: any) => r.user_id}
            renderItem={({ item, index }: any) => (
              <Card style={{ marginBottom: 10 }}>
                <TotlText variant="heading">
                  {index + 1}. {item.name}
                </TotlText>
                <TotlText variant="muted">Score: {item.score} · Unicorns: {item.unicorns}</TotlText>
              </Card>
            )}
          />
        </>
      )}

      {data && (
        <FlatList
          data={data.members}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: t.space[4], paddingBottom: t.space[8] }}
          keyExtractor={(m: any) => m.id}
          renderItem={({ item }: any) => (
            <Card style={{ marginBottom: 10 }}>
              <TotlText>{item.name}</TotlText>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

