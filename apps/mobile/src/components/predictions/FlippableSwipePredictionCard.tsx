import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Fixture } from '@totl/domain';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import SwipePredictionCard from './SwipePredictionCard';
import SwipePredictionStatsBack from './SwipePredictionStatsBack';
import type { MatchPreviewStats } from '../../lib/matchPreviewStats';

/**
 * Visual flip between prediction face and stats back.
 * Tap handling lives in PredictionsSwipeDeck (composes with pan).
 * Rotates around the card centre; mid-flip scale pops it toward you.
 */
export default function FlippableSwipePredictionCard({
  fixture,
  homeForm,
  awayForm,
  stats,
  showSwipeHint = true,
  flipped,
}: {
  fixture: Fixture;
  homeForm?: string | null;
  awayForm?: string | null;
  stats: MatchPreviewStats;
  showSwipeHint?: boolean;
  flipped: boolean;
}) {
  const progress = useSharedValue(flipped ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(flipped ? 1 : 0, {
      duration: 480,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [flipped, progress]);

  const shellStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 0.5, 1], [1, 1.32, 1]);
    return {
      flex: 1,
      transform: [{ perspective: 1400 }, { scale }],
    };
  });

  const frontStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [0, 180]);
    return {
      ...StyleSheet.absoluteFillObject,
      backfaceVisibility: 'hidden' as const,
      transformOrigin: 'center',
      transform: [{ rotateY: `${rotate}deg` }],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [180, 360]);
    return {
      ...StyleSheet.absoluteFillObject,
      backfaceVisibility: 'hidden' as const,
      transformOrigin: 'center',
      transform: [{ rotateY: `${rotate}deg` }],
    };
  });

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={shellStyle}>
        <Animated.View style={frontStyle} pointerEvents={flipped ? 'none' : 'auto'}>
          <SwipePredictionCard
            fixture={fixture}
            homeForm={homeForm}
            awayForm={awayForm}
            showSwipeHint={showSwipeHint && !flipped}
          />
        </Animated.View>
        <Animated.View style={backStyle} pointerEvents={flipped ? 'auto' : 'none'}>
          <SwipePredictionStatsBack
            stats={stats}
            homeCode={fixture.home_code}
            awayCode={fixture.away_code}
            kickoffTime={fixture.kickoff_time}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
