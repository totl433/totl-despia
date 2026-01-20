import React from 'react';
import { FlatList, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Card, Screen, TotlText } from '@totl/ui';

import { api } from '../lib/api';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';

export default function LeaguesScreen() {
  const navigation = useNavigation<any>();
  const { data, isLoading } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  return (
    <Screen>
      <TotlText variant="heading" style={{ marginBottom: 12 }}>
        Leagues
      </TotlText>

      {isLoading && <TotlText variant="muted">Loading…</TotlText>}

      {data && (
        <FlatList
          data={data.leagues}
          keyExtractor={(l: any) => l.id}
          renderItem={({ item }: any) => (
            <Pressable
              onPress={() => navigation.navigate('LeagueDetail', { leagueId: item.id, name: item.name } satisfies LeaguesStackParamList['LeagueDetail'])}
            >
              <Card style={{ marginBottom: 10 }}>
                <TotlText variant="heading">{item.name}</TotlText>
                <TotlText variant="muted">Code: {item.code}</TotlText>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

