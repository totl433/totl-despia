import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { TotlRefreshControl } from '../lib/refreshControl';

type Pick = 'H' | 'D' | 'A';

export default function PredictionsScreen() {
  const t = useTokens();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
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
    <Screen fullBleed>
      <PageHeader title="Predictions" />

      <FlatList
        data={data?.fixtures ?? []}
        style={{ flex: 1 }}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: t.space[4], paddingBottom: t.space[8] }}
        refreshControl={<TotlRefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        ListHeaderComponent={
          <>
            {isLoading && <TotlText variant="muted">Loading…</TotlText>}
            {error && (
              <Card style={{ marginBottom: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load predictions
                </TotlText>
                <TotlText variant="muted">{(error as any)?.message ?? 'Unknown error'}</TotlText>
              </Card>
            )}

            {data && (
              <Card style={{ marginBottom: 12 }}>
                <TotlText>GW {data.gw}</TotlText>
                <TotlText variant="caption" style={{ marginBottom: 12 }}>
                  {data.submitted ? 'Submitted' : 'Not submitted'}
                </TotlText>
                <Button
                  title={data.submitted ? 'Submitted' : 'Submit predictions'}
                  onPress={() => submitMutation.mutate({ gw: data.gw })}
                  disabled={data.submitted}
                  loading={submitMutation.isPending}
                />
              </Card>
            )}
          </>
        }
        ListEmptyComponent={
          !isLoading && !error ? (
            <Card>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                No fixtures yet
              </TotlText>
              <TotlText variant="muted">Pull to refresh.</TotlText>
            </Card>
          ) : null
        }
        renderItem={({ item }: any) => {
          const pick = effectivePicks[item.fixture_index];
          const canEdit = !!data && !data.submitted;

          return (
            <Card style={{ marginBottom: 10 }}>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                {item.home_name ?? item.home_team} vs {item.away_name ?? item.away_team}
              </TotlText>
              <TotlText variant="muted" style={{ marginBottom: 10 }}>
                {item.kickoff_time ? new Date(item.kickoff_time).toLocaleString() : 'TBD'}
              </TotlText>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  size="sm"
                  variant={pick === 'H' ? 'primary' : 'secondary'}
                  title="H"
                  onPress={() => setPick(item.fixture_index, 'H')}
                  disabled={!canEdit}
                  loading={canEdit && saveMutation.isPending}
                />
                <Button
                  size="sm"
                  variant={pick === 'D' ? 'primary' : 'secondary'}
                  title="D"
                  onPress={() => setPick(item.fixture_index, 'D')}
                  disabled={!canEdit}
                  loading={canEdit && saveMutation.isPending}
                />
                <Button
                  size="sm"
                  variant={pick === 'A' ? 'primary' : 'secondary'}
                  title="A"
                  onPress={() => setPick(item.fixture_index, 'A')}
                  disabled={!canEdit}
                  loading={canEdit && saveMutation.isPending}
                />
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

