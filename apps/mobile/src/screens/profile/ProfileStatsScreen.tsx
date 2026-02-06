import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';
import { getGameweekStateFromSnapshot } from '../../lib/gameweekState';

export default function ProfileStatsScreen() {
  const t = useTokens();
  const lastAutoRefreshedGwRef = React.useRef<number | null>(null);

  const homeSnapshotQ = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });

  const statsQ = useQuery({
    queryKey: ['profile-stats'],
    queryFn: () => api.getProfileStats(),
  });

  const unicornsQ = useQuery({
    queryKey: ['profile-unicorns'],
    queryFn: () => api.getProfileUnicorns(),
  });

  const refreshing = homeSnapshotQ.isRefetching || statsQ.isRefetching || unicornsQ.isRefetching;
  const onRefresh = React.useCallback(() => {
    void Promise.all([homeSnapshotQ.refetch(), statsQ.refetch(), unicornsQ.refetch()]);
  }, [homeSnapshotQ, statsQ, unicornsQ]);

  // Game-state-aware refresh: avoid thrashing during LIVE, but auto-refresh once when results become available.
  React.useEffect(() => {
    const snap = homeSnapshotQ.data ?? null;
    const stats = statsQ.data ?? null;
    if (!snap || !stats) return;

    const state = getGameweekStateFromSnapshot({
      fixtures: snap.fixtures ?? [],
      liveScores: snap.liveScores ?? [],
      hasSubmittedViewingGw: !!snap.hasSubmittedViewingGw,
    });

    if (state === 'LIVE') return;
    if (state !== 'RESULTS_PRE_GW') return;

    const lastCompleted = stats.lastCompletedGw ?? null;
    if (!lastCompleted) return;

    if (lastAutoRefreshedGwRef.current === lastCompleted) return;
    lastAutoRefreshedGwRef.current = lastCompleted;
    void statsQ.refetch();
  }, [homeSnapshotQ.data, statsQ]);

  const showInitialSpinner =
    (statsQ.isLoading && !statsQ.data && !statsQ.error) || (unicornsQ.isLoading && !unicornsQ.data && !unicornsQ.error);
  if (showInitialSpinner) {
    return (
      <Screen fullBleed>
        <PageHeader title="Stats" />
        <CenteredSpinner loading />
      </Screen>
    );
  }

  const stats = statsQ.data ?? null;
  const unicorns = unicornsQ.data?.unicorns ?? [];

  const topLabel = (pct: number | null | undefined) => {
    if (typeof pct !== 'number' || Number.isNaN(pct)) return '—';
    const top = Math.max(1, Math.min(100, Math.round(100 - pct)));
    return `Top ${top}%`;
  };

  const StatRow = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.18)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <TotlText variant="muted">{label}</TotlText>
        <TotlText style={{ fontWeight: '900' }}>{value}</TotlText>
      </View>
      {sub ? (
        <TotlText variant="muted" style={{ marginTop: 6 }}>
          {sub}
        </TotlText>
      ) : null}
    </View>
  );

  return (
    <Screen fullBleed>
      <PageHeader title="Stats" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {(statsQ.error || unicornsQ.error) ? (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Couldn’t load stats
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {String((statsQ.error as any)?.message ?? (unicornsQ.error as any)?.message ?? 'Unknown error')}
            </TotlText>
            <Button title="Retry" onPress={() => onRefresh()} loading={refreshing} />
          </Card>
        ) : null}

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Your performance
          </TotlText>

          <StatRow
            label={stats?.lastCompletedGw ? `Gameweek ${stats.lastCompletedGw}` : 'Last completed GW'}
            value={topLabel(stats?.lastCompletedGwPercentile ?? null)}
            sub={
              typeof stats?.lastCompletedGwPercentile === 'number'
                ? `${stats.lastCompletedGwPercentile.toFixed(0)}th percentile`
                : undefined
            }
          />
          <StatRow
            label="Overall"
            value={topLabel(stats?.overallPercentile ?? null)}
            sub={typeof stats?.overallPercentile === 'number' ? `${stats.overallPercentile.toFixed(0)}th percentile` : undefined}
          />
          <StatRow
            label="Correct prediction rate"
            value={typeof stats?.correctPredictionRate === 'number' ? `${stats.correctPredictionRate.toFixed(0)}%` : '—'}
          />
          <StatRow
            label="Average points per week"
            value={typeof stats?.avgPointsPerWeek === 'number' ? stats.avgPointsPerWeek.toFixed(1) : '—'}
          />

          <View style={{ paddingVertical: 12 }}>
            <TotlText variant="muted">Best streak (top 25%)</TotlText>
            <TotlText style={{ marginTop: 4, fontWeight: '900' }}>
              {stats?.bestStreak ? `${stats.bestStreak} weeks` : '—'}
            </TotlText>
            {stats?.bestStreakGwRange ? (
              <TotlText variant="muted" style={{ marginTop: 6 }}>
                {stats.bestStreakGwRange}
              </TotlText>
            ) : null}
          </View>
        </Card>

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Highlights
          </TotlText>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TotlText variant="muted">Best gameweek</TotlText>
              <TotlText style={{ fontWeight: '900' }}>
                {stats?.bestSingleGw ? `${stats.bestSingleGw.points} (GW${stats.bestSingleGw.gw})` : '—'}
              </TotlText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TotlText variant="muted">Lowest gameweek</TotlText>
              <TotlText style={{ fontWeight: '900' }}>
                {stats?.lowestSingleGw ? `${stats.lowestSingleGw.points} (GW${stats.lowestSingleGw.gw})` : '—'}
              </TotlText>
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Trophy cabinet
          </TotlText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Gameweek', v: stats?.trophyCabinet?.lastGw ?? 0 },
              { label: '5-week', v: stats?.trophyCabinet?.form5 ?? 0 },
              { label: '10-week', v: stats?.trophyCabinet?.form10 ?? 0 },
              { label: 'Overall', v: stats?.trophyCabinet?.overall ?? 0 },
            ].map((x) => (
              <View
                key={x.label}
                style={{
                  flexGrow: 1,
                  minWidth: 140,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor: 'rgba(148,163,184,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(148,163,184,0.22)',
                }}
              >
                <TotlText variant="muted">{x.label}</TotlText>
                <TotlText style={{ marginTop: 6, fontWeight: '900', fontSize: 18 }}>{String(x.v)}</TotlText>
              </View>
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Chaos Index
          </TotlText>
          <TotlText style={{ fontWeight: '900', fontSize: 20 }}>
            {typeof stats?.chaosIndex === 'number' ? `${stats.chaosIndex.toFixed(0)}%` : '—'}
          </TotlText>
          {typeof stats?.chaosTotalCount === 'number' && typeof stats?.chaosCorrectCount === 'number' ? (
            <TotlText variant="muted" style={{ marginTop: 6 }}>
              {stats.chaosCorrectCount} correct chaos picks out of {stats.chaosTotalCount}
            </TotlText>
          ) : null}
        </Card>

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Teams
          </TotlText>
          <View style={{ gap: 12 }}>
            <View
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: 'rgba(16,185,129,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(16,185,129,0.20)',
              }}
            >
              <TotlText variant="muted">Most correct</TotlText>
              <TotlText style={{ marginTop: 6, fontWeight: '900' }}>{stats?.mostCorrectTeam?.name ?? '—'}</TotlText>
              {typeof stats?.mostCorrectTeam?.percentage === 'number' ? (
                <TotlText variant="muted" style={{ marginTop: 4 }}>
                  {stats.mostCorrectTeam.percentage.toFixed(0)}% correct
                </TotlText>
              ) : null}
            </View>

            <View
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: 'rgba(239,68,68,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.18)',
              }}
            >
              <TotlText variant="muted">Most incorrect</TotlText>
              <TotlText style={{ marginTop: 6, fontWeight: '900' }}>{stats?.mostIncorrectTeam?.name ?? '—'}</TotlText>
              {typeof stats?.mostIncorrectTeam?.percentage === 'number' ? (
                <TotlText variant="muted" style={{ marginTop: 4 }}>
                  {stats.mostIncorrectTeam.percentage.toFixed(0)}% incorrect
                </TotlText>
              ) : null}
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Your unicorns
          </TotlText>
          {unicorns.length === 0 ? (
            <TotlText variant="muted">You have 0 unicorns overall. Keep predicting to earn your first unicorn!</TotlText>
          ) : (
            <>
              <TotlText variant="muted" style={{ marginBottom: 10 }}>
                {unicorns.length} {unicorns.length === 1 ? 'unicorn' : 'unicorns'} overall
              </TotlText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {unicorns.map((u) => (
                  <View
                    key={`${u.gw}-${u.fixture_index}`}
                    style={{
                      width: 240,
                      padding: 14,
                      borderRadius: 18,
                      backgroundColor: 'rgba(28,131,118,0.08)',
                      borderWidth: 1,
                      borderColor: 'rgba(28,131,118,0.18)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <TotlText style={{ fontWeight: '900' }}>{`GW${u.gw}`}</TotlText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TotlText variant="muted" style={{ fontWeight: '900' }}>
                          {u.pick}
                        </TotlText>
                        <Ionicons name="sparkles" size={16} color="#1C8376" />
                      </View>
                    </View>
                    <TotlText style={{ marginTop: 8, fontWeight: '900' }} numberOfLines={1}>
                      {u.home_name ?? u.home_team} v {u.away_name ?? u.away_team}
                    </TotlText>
                    <TotlText variant="muted" style={{ marginTop: 6 }} numberOfLines={2}>
                      {u.league_names.join(', ')}
                    </TotlText>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </Card>

        {Array.isArray(stats?.weeklyParData) && stats!.weeklyParData.length > 0 ? (
          <Card style={{ marginBottom: 12, padding: 16 }}>
            <TotlText variant="heading" style={{ marginBottom: 10 }}>
              Weekly par
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 10 }}>
              Your points vs the average for each gameweek.
            </TotlText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
              {stats!.weeklyParData.map((w) => {
                const diff = w.userPoints - w.averagePoints;
                const above = diff > 0;
                return (
                  <View
                    key={String(w.gw)}
                    style={{
                      width: 90,
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(148,163,184,0.18)',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <TotlText variant="muted">{`GW${w.gw}`}</TotlText>
                    <TotlText style={{ marginTop: 6, fontWeight: '900' }}>{String(w.userPoints)}</TotlText>
                    <TotlText variant="muted" style={{ marginTop: 4 }}>
                      av. {w.averagePoints.toFixed(1)}
                    </TotlText>
                    <TotlText style={{ marginTop: 6, fontWeight: '900', color: above ? '#059669' : diff < 0 ? '#DC2626' : t.color.text }}>
                      {diff === 0 ? 'Par' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`}
                    </TotlText>
                  </View>
                );
              })}
            </ScrollView>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

