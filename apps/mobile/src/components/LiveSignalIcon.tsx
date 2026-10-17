import React from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Broadcast / live signal mark — center dot with pulsing side arcs.
 * Preview-friendly: pass pulse={true} to always animate.
 */
export default function LiveSignalIcon({
  size = 26,
  color = '#EF4444',
  pulse = true,
}: {
  size?: number;
  color?: string;
  pulse?: boolean;
}) {
  const breathe = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!pulse) {
      breathe.stopAnimation();
      breathe.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 0.28,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, pulse]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity: breathe, width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          {/* Outer arcs */}
          <Path
            d="M4.2 8.2a9.2 9.2 0 0 1 0 7.6"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
          <Path
            d="M19.8 8.2a9.2 9.2 0 0 0 0 7.6"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
          {/* Inner arcs */}
          <Path
            d="M7.1 9.6a5.6 5.6 0 0 1 0 4.8"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
          <Path
            d="M16.9 9.6a5.6 5.6 0 0 0 0 4.8"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
          {/* Center */}
          <Circle cx={12} cy={12} r={2.35} stroke={color} strokeWidth={1.9} fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}
