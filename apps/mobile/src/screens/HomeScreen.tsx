import React from 'react';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText } from '@totl/ui';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });

  const liveByFixtureIndex = React.useMemo(() => {
    const m = new Map<number, any>();
    if (!data) return m;
    const apiMatchIdToFixtureIndex = new Map<number, number>();
    data.fixtures.forEach((f: any) => {
      if (typeof f.api_match_id === 'number') apiMatchIdToFixtureIndex.set(f.api_match_id, f.fixture_index);
    });
    (data.liveScores ?? []).forEach((ls: any) => {
      const idx =
        typeof ls.fixture_index === 'number'
          ? ls.fixture_index
          : typeof ls.api_match_id === 'number'
            ? apiMatchIdToFixtureIndex.get(ls.api_match_id)
            : undefined;
      if (idx === undefined) return;
      m.set(idx, ls);
    });
    return m;
  }, [data]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <TotlText variant="heading">Home</TotlText>
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </View>

      {isLoading && <TotlText variant="muted">Loading…</TotlText>}
      {error && (
        <Card>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Couldn’t load
          </TotlText>
          <TotlText variant="muted" style={{ marginBottom: 12 }}>
            {(error as any)?.message ?? 'Unknown error'}
          </TotlText>
          <Button title={isRefetching ? 'Refreshing…' : 'Retry'} onPress={() => refetch()} />
        </Card>
      )}

      {data && (
        <Card style={{ marginBottom: 12 }}>
          <TotlText>Current GW: {data.currentGw}</TotlText>
          <TotlText>Viewing GW: {data.viewingGw}</TotlText>
          <TotlText variant="muted">Fixtures: {data.fixtures.length}</TotlText>
        </Card>
      )}

      {data && (
        <FlatList
          data={data.fixtures}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10 }}>
              <TotlText variant="heading" style={{ marginBottom: 4 }}>
                {item.home_name ?? item.home_team} vs {item.away_name ?? item.away_team}
              </TotlText>
              <TotlText variant="muted">
                {item.kickoff_time ? new Date(item.kickoff_time).toLocaleString() : 'TBD'}
              </TotlText>
              {liveByFixtureIndex.has(item.fixture_index) && (
                <TotlText variant="muted" style={{ marginTop: 6 }}>
                  {(() => {
                    const ls = liveByFixtureIndex.get(item.fixture_index);
                    const hs = ls?.home_score ?? 0;
                    const as = ls?.away_score ?? 0;
                    const st = ls?.status ?? 'SCHEDULED';
                    return `Live: ${hs}-${as} (${st})`;
                  })()}
                </TotlText>
              )}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

