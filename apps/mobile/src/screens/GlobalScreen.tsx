import React from 'react';
import { FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, TotlText } from '@totl/ui';

import { api } from '../lib/api';

export default function GlobalScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'overall'],
    queryFn: () => api.getOverallLeaderboard(),
  });

  return (
    <Screen>
      <TotlText variant="heading" style={{ marginBottom: 12 }}>
        Global
      </TotlText>

      {isLoading && <TotlText variant="muted">Loading…</TotlText>}

      {data && (
        <FlatList
          data={data.rows}
          keyExtractor={(r: any) => r.user_id}
          renderItem={({ item, index }: any) => (
            <Card style={{ marginBottom: 10 }}>
              <TotlText variant="heading">
                {index + 1}. {item.name ?? 'User'}
              </TotlText>
              <TotlText variant="muted">OCP: {item.ocp ?? 0}</TotlText>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

