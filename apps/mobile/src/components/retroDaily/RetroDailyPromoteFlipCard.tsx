import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import RetroDailyFixtureCard from './RetroDailyFixtureCard';
import RetroDailyLogoBack from './RetroDailyLogoBack';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';

/** Brief peek on the under-card face before revealing the fixture. */
export const RETRO_PROMOTE_FLIP_DELAY_MS = 450;
/** Card-flip duration into the fixture face. */
export const RETRO_PROMOTE_FLIP_MS = 720;
/** Shorter hold when coming off the 3-2-1 face. */
export const RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS = 280;

/**
 * Holds on the logo (or custom) back, then flips to the fixture face.
 */
export default function RetroDailyPromoteFlipCard({
  fixture,
  flipKey,
  backFace,
  holdMs = RETRO_PROMOTE_FLIP_DELAY_MS,
  flipMs = RETRO_PROMOTE_FLIP_MS,
}: {
  fixture: RetroFixture;
  flipKey: number;
  backFace?: React.ReactNode;
  holdMs?: number;
  flipMs?: number;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      holdMs,
      withTiming(1, {
        duration: flipMs,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      })
    );
  }, [flipKey, fixture.id, flipMs, holdMs, progress]);

  const backStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [0, 180]);
    return {
      ...StyleSheet.absoluteFillObject,
      backfaceVisibility: 'hidden' as const,
      transform: [{ perspective: 1200 }, { rotateY: `${rotate}deg` }],
    };
  });

  const frontStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [180, 360]);
    return {
      ...StyleSheet.absoluteFillObject,
      backfaceVisibility: 'hidden' as const,
      transform: [{ perspective: 1200 }, { rotateY: `${rotate}deg` }],
    };
  });

  return (
    <View style={{ flex: 1, borderRadius: 28, overflow: 'hidden' }}>
      <Animated.View style={backStyle}>{backFace ?? <RetroDailyLogoBack />}</Animated.View>
      <Animated.View style={frontStyle}>
        <RetroDailyFixtureCard fixture={fixture} />
      </Animated.View>
    </View>
  );
}
