import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const FACE = {
  ...StyleSheet.absoluteFillObject,
  backfaceVisibility: 'hidden' as const,
};

/**
 * 3D flip used by The Players / Retro Totl Daily.
 * Same recipe as FlippableSwipePredictionCard: perspective on a shell,
 * one face at a time via backfaceVisibility, no overflow clipping.
 */
export default function RetroDailyFlip({
  showB,
  durationMs,
  faceA,
  faceB,
  resetKey,
}: {
  showB: boolean;
  durationMs: number;
  faceA: React.ReactNode;
  faceB: React.ReactNode;
  resetKey: string | number;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    if (!showB) return;
    const id = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: durationMs,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
    }, 16);
    return () => clearTimeout(id);
  }, [durationMs, progress, resetKey, showB]);

  const shellStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 0.5, 1], [1, 1.08, 1]);
    return {
      flex: 1,
      transform: [{ perspective: 1400 }, { scale }],
    };
  });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(progress.value, [0, 1], [180, 360])}deg` }],
  }));

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={shellStyle}>
        <Animated.View style={[FACE, frontStyle]} pointerEvents="none">
          {faceA as React.ReactElement}
        </Animated.View>
        <Animated.View style={[FACE, backStyle]} pointerEvents="none">
          {faceB as React.ReactElement}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
