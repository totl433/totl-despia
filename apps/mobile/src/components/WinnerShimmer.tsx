import React from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function WinnerShimmer({
  durationMs,
  delayMs,
  opacity,
  tint,
}: {
  durationMs: number;
  delayMs: number;
  opacity: number;
  tint: 'white' | 'gold';
}) {
  const anim = React.useRef(new Animated.Value(0)).current;
  const [w, setW] = React.useState(0);

  React.useEffect(() => {
    anim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(anim, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: true }
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delayMs, durationMs]);

  const width = w || 220;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const shimmerColors =
    tint === 'gold'
      ? (['transparent', 'rgba(253, 230, 138, 0.55)', 'transparent'] as const)
      : (['transparent', 'rgba(255,255,255,0.75)', 'transparent'] as const);

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: -22,
          bottom: -22,
          width: Math.max(120, width * 0.55),
          opacity,
          transform: [{ translateX }, { rotate: '14deg' }],
        }}
      >
        <LinearGradient colors={shimmerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

