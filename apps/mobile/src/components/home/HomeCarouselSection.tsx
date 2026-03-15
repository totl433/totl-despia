import React from 'react';
import { Animated, Image, View } from 'react-native';
import type { Fixture, GwResults, HomeRanks, HomeSnapshot } from '@totl/domain';
import { useTokens } from '@totl/ui';
import { LeaderboardCardResultsCta } from './LeaderboardCards';
import GameweekCountdownItem from './GameweekCountdownItem';

const LB_BADGE_5 = require('../../../../../dist/assets/5-week-form-badge.png');
const TIME_ICON = require('../../../assets/icons/time.png');

export interface HomeCarouselSectionProps {
  visible: boolean;
  marginTop: number;
  marginBottom: number;
  ranks: HomeRanks | null | undefined;
  home: HomeSnapshot | null | undefined;
  latestGwResults: GwResults | null | undefined;
  scoreSummary: { correct: number; total: number } | null;
  fixtures: Fixture[];
  deadlineExpired: boolean;
  showMakePicksBanner: boolean;
  showComingSoonBanner: boolean;
  currentGw: number | null;
  gwState: string | null;
  dismissedCountdownGw: number | null;
  onDismissCountdown: (gw: number) => void;
  onNavigatePredictions: () => void;
  onNavigateGameweekResults: (gw: number, mode?: string) => void;
  onNavigateGlobal: (initialTab?: string) => void;
}

/**
 * Horizontal carousel of leaderboard/performance cards (GW results, current score, coming soon, overall).
 * Can be toggled via the `visible` prop (e.g. for A/B testing).
 */
export default function HomeCarouselSection({
  visible,
  marginTop,
  marginBottom,
  ranks,
  home,
  latestGwResults,
  scoreSummary,
  fixtures,
  deadlineExpired,
  showMakePicksBanner,
  showComingSoonBanner,
  currentGw,
  gwState,
  dismissedCountdownGw,
  onDismissCountdown,
  onNavigatePredictions,
  onNavigateGameweekResults,
  onNavigateGlobal,
}: HomeCarouselSectionProps) {
  const t = useTokens();

  if (!visible) return null;

  const gw = ranks?.latestGw ?? home?.viewingGw ?? null;
  const scoreFromRanks = ranks?.gwRank?.score;
  const totalFromRanks = ranks?.gwRank?.totalFixtures;

  const fallbackScore =
    typeof latestGwResults?.score === 'number' && Number.isFinite(latestGwResults.score)
      ? String(latestGwResults.score)
      : '--';
  const fallbackTotal =
    typeof latestGwResults?.totalFixtures === 'number' && Number.isFinite(latestGwResults.totalFixtures)
      ? String(latestGwResults.totalFixtures)
      : '--';

  const score = typeof scoreFromRanks === 'number' ? String(scoreFromRanks) : fallbackScore;
  const total = typeof totalFromRanks === 'number' ? String(totalFromRanks) : fallbackTotal;

  const showReadyToPredictCta = showMakePicksBanner && typeof home?.viewingGw === 'number' && !deadlineExpired;
  const showResultsCta =
    gwState === 'RESULTS_PRE_GW' && !!home?.hasSubmittedViewingGw && typeof home?.viewingGw === 'number';
  const resultsGw = typeof home?.viewingGw === 'number' ? home.viewingGw : ranks?.latestGw ?? null;

  const cards: Array<{ key: string; node: React.ReactNode }> = [];

  if (showReadyToPredictCta && resultsGw) {
    cards.push({
      key: 'gw-ready-to-predict',
      node: (
        <LeaderboardCardResultsCta
          gw={resultsGw}
          badge={LB_BADGE_5}
          label="Ready to predict (swipe)"
          onPress={onNavigatePredictions}
        />
      ),
    });
  } else if (showResultsCta && resultsGw) {
    const predictionsLocked = Boolean(home?.hasSubmittedViewingGw) || deadlineExpired;
    const viewingGwForCountdown =
      typeof home?.viewingGw === 'number' ? home.viewingGw : typeof home?.currentGw === 'number' ? home.currentGw : null;

    if (predictionsLocked && typeof viewingGwForCountdown === 'number') {
      const wallNowMs = Date.now();
      const firstFixture = fixtures
        .filter((f) => {
          const k = f?.kickoff_time ? new Date(f.kickoff_time).getTime() : NaN;
          return Number.isFinite(k);
        })
        .map((f) => ({ f, k: new Date(f.kickoff_time as string).getTime() }))
        .sort((a, b) => a.k - b.k)[0]?.f;

      const firstFixtureKickoffTimeMs = firstFixture?.kickoff_time ? new Date(firstFixture.kickoff_time).getTime() : null;

      const countdownVisible =
        typeof firstFixtureKickoffTimeMs === 'number' &&
        Number.isFinite(firstFixtureKickoffTimeMs) &&
        wallNowMs < firstFixtureKickoffTimeMs &&
        dismissedCountdownGw !== viewingGwForCountdown;

      if (countdownVisible && firstFixtureKickoffTimeMs && firstFixture) {
        cards.push({
          key: 'gw-kickoff-countdown',
          node: (
            <GameweekCountdownItem
              variant="tile"
              gw={viewingGwForCountdown}
              kickoffTimeMs={firstFixtureKickoffTimeMs}
              homeCode={String(firstFixture?.home_code ?? '').toUpperCase() || null}
              awayCode={String(firstFixture?.away_code ?? '').toUpperCase() || null}
              onKickedOff={() => onDismissCountdown(viewingGwForCountdown)}
            />
          ),
        });
      }
    }

    cards.push({
      key: 'gw-results',
      node: (
        <LeaderboardCardResultsCta
          gw={resultsGw}
          badge={LB_BADGE_5}
          score={score}
          totalFixtures={total}
          onPress={() => onNavigateGameweekResults(resultsGw)}
        />
      ),
    });
  } else if (!showComingSoonBanner && resultsGw) {
    const currentScore = typeof scoreSummary?.correct === 'number' ? String(scoreSummary.correct) : '--';
    const currentTotal =
      typeof scoreSummary?.total === 'number' && scoreSummary.total > 0 ? String(scoreSummary.total) : '--';
    cards.push({
      key: 'gw-current-score',
      node: (
        <LeaderboardCardResultsCta
          gw={resultsGw}
          badge={LB_BADGE_5}
          score={currentScore}
          totalFixtures={currentTotal}
          label="Current Score"
          tone="gradient"
          showSheen
          rightActionIcon="share"
          onPress={() => onNavigateGameweekResults(resultsGw, 'fixturesShare')}
        />
      ),
    });
  }

  if (showComingSoonBanner) {
    const upcomingGw = typeof currentGw === 'number' ? currentGw + 1 : null;
    cards.push({
      key: 'gw-coming-soon',
      node: (
        <LeaderboardCardResultsCta
          topLabel={upcomingGw ? `Gameweek ${upcomingGw}` : 'Gameweek'}
          leftNode={<Image source={TIME_ICON} style={{ width: 28, height: 28 }} resizeMode="contain" />}
          badge={null}
          label="Coming Soon!"
          tone="light"
          showSheen={false}
        />
      ),
    });
  }

  cards.push({
    key: 'performance-summary-cta',
    node: (
      <LeaderboardCardResultsCta
        topLabel="OVERALL"
        badge={LB_BADGE_5}
        tone="light"
        showSheen={false}
        label="Your Performance"
        onPress={() => onNavigateGlobal('overall')}
      />
    ),
  });

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -t.space[4], marginTop, marginBottom }}
      contentContainerStyle={{ paddingHorizontal: t.space[4], paddingBottom: 12 }}
    >
      {cards.map((c, idx) => (
        <View key={c.key} style={{ marginRight: idx === cards.length - 1 ? 0 : 10 }}>
          {c.node}
        </View>
      ))}
    </Animated.ScrollView>
  );
}
