import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText } from '@totl/ui';

import { api } from '../lib/api';

type Pick = 'H' | 'D' | 'A';

export default function PredictionsScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => api.getPredictions(),
  });

  const [localPicks, setLocalPicks] = useState<Record<number, Pick>>({});

  const effectivePicks = useMemo(() => {
    const fromApi: Record<number, Pick> = {};
    (data?.picks ?? []).forEach((p: any) => {
      fromApi[p.fixture_index] = p.pick;
    });
    return { ...fromApi, ...localPicks };
  }, [data?.picks, localPicks]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { gw: number; picks: Array<{ fixture_index: number; pick: Pick }> }) =>
      api.savePredictions(payload),
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: { gw: number }) => api.submitPredictions(payload),
    onSuccess: () => refetch(),
  });

  const setPick = (fixture_index: number, pick: Pick) => {
    if (!data) return;
    if (data.submitted) return;
    setLocalPicks((prev) => ({ ...prev, [fixture_index]: pick }));
    saveMutation.mutate({
      gw: data.gw,
      picks: [{ fixture_index, pick }],
    });
  };

  return (
    <Screen>
      <TotlText variant="heading" style={{ marginBottom: 12 }}>
        Predictions
      </TotlText>

      {isLoading && <TotlText variant="muted">Loading…</TotlText>}

      {data && (
        <Card style={{ marginBottom: 12 }}>
          <TotlText>GW {data.gw}</TotlText>
          <TotlText variant="muted" style={{ marginBottom: 12 }}>
            {data.submitted ? 'Submitted' : 'Not submitted'}
          </TotlText>
          <Button
            title={submitMutation.isPending ? 'Submitting…' : data.submitted ? 'Submitted' : 'Submit predictions'}
            onPress={() => submitMutation.mutate({ gw: data.gw })}
            disabled={data.submitted || submitMutation.isPending}
          />
        </Card>
      )}

      {data && (
        <FlatList
          data={data.fixtures}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => {
            const pick = effectivePicks[item.fixture_index];
            return (
              <Card style={{ marginBottom: 10 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  {item.home_name ?? item.home_team} vs {item.away_name ?? item.away_team}
                </TotlText>
                <TotlText variant="muted" style={{ marginBottom: 10 }}>
                  {item.kickoff_time ? new Date(item.kickoff_time).toLocaleString() : 'TBD'}
                </TotlText>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title={`H${pick === 'H' ? ' ✓' : ''}`} onPress={() => setPick(item.fixture_index, 'H')} disabled={data.submitted} />
                  <Button title={`D${pick === 'D' ? ' ✓' : ''}`} onPress={() => setPick(item.fixture_index, 'D')} disabled={data.submitted} />
                  <Button title={`A${pick === 'A' ? ' ✓' : ''}`} onPress={() => setPick(item.fixture_index, 'A')} disabled={data.submitted} />
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

