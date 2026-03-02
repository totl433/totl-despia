import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTokens } from '@totl/ui';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function roundedRectPerimeter(w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  // 2*(w+h-4r) straight segments + 2πr arcs
  return 2 * (w + h - 4 * rr) + 2 * Math.PI * rr;
}

/**
 * Subtle 1px perimeter dash that loops around the inside of a rounded card.
 *
 * Tuning:
 * - speed: `LAP_MS`
 * - dash length: `DASH_LEN`
 * - opacity: `OPACITY`
 * - radius: pass `radius`
 */
export default function AnimatedPerimeterGlow({
  active,
  radius,
}: {
  active: boolean;
  radius: number;
}) {
  const t = useTokens();
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Visual tuning (keep subtle/premium).
  const STROKE_W = 1;
  const DASH_LEN = 18;
  const LAP_MS = 8000; // 6–10s per lap (spec)
  const OPACITY = 0.32;

  const dashOffset = useSharedValue(0);

  const perimeter = React.useMemo(() => {
    if (!size.w || !size.h) return 0;
    const innerW = Math.max(0, size.w - STROKE_W);
    const innerH = Math.max(0, size.h - STROKE_W);
    const innerR = Math.max(0, radius - STROKE_W / 2);
    return roundedRectPerimeter(innerW, innerH, innerR);
  }, [radius, size.h, size.w]);

  React.useEffect(() => {
    if (!active || perimeter <= 0) {
      cancelAnimation(dashOffset);
      dashOffset.value = 0;
      return;
    }
    dashOffset.value = withRepeat(
      withTiming(perimeter, { duration: LAP_MS, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(dashOffset);
  }, [active, dashOffset, perimeter]);

  const animatedProps = useAnimatedProps(() => {
    return { strokeDashoffset: dashOffset.value };
  });

  const strokeColor = `rgba(255,255,255,${OPACITY})`;

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        const h = Math.round(e.nativeEvent.layout.height);
        if (!w || !h) return;
        setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      {size.w && size.h ? (
        <Svg width={size.w} height={size.h}>
          <AnimatedRect
            animatedProps={animatedProps}
            x={STROKE_W / 2}
            y={STROKE_W / 2}
            width={size.w - STROKE_W}
            height={size.h - STROKE_W}
            rx={Math.max(0, radius - STROKE_W / 2)}
            ry={Math.max(0, radius - STROKE_W / 2)}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={STROKE_W}
            strokeDasharray={`${DASH_LEN} ${Math.max(1, perimeter - DASH_LEN)}`}
          />
        </Svg>
      ) : null}

      {/* Slightly fade edges into the card so it feels inside, not on top */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: t.color.border,
          opacity: 0.12,
        }}
      />
    </View>
  );
}

