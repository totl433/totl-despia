import React from 'react';
import { AccessibilityInfo, LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { TotlText, useTokens } from '@totl/ui';

export type SegmentedItem<K extends string> = { key: K; label: string };

function SegmentButton<K extends string>({
  label,
  index,
  activeIndexSV,
  inactiveColor,
  height,
  active,
  onPress,
  onLayout,
}: {
  label: string;
  index: number;
  activeIndexSV: { value: number };
  inactiveColor: string;
  height: number;
  active: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      style={({ pressed }) => ({
        flex: 1,
        height,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <TotlText
        variant="body"
        style={{
          fontWeight: '900',
          color: active ? '#FFFFFF' : inactiveColor,
        }}
      >
        {label}
      </TotlText>
    </Pressable>
  );
}

/**
 * iOS-style segmented “pill” control with a sliding indicator, matching the animation
 * pattern used in `LeagueTabBar` (layout-measured, Reanimated-driven).
 */
export default function SegmentedPillControl<K extends string>({
  items,
  value,
  onChange,
  height = 46,
}: {
  items: Array<SegmentedItem<K>>;
  value: K;
  onChange: (next: K) => void;
  height?: number;
}) {
  const t = useTokens();
  const reduceMotionRef = React.useRef(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!alive) return;
        reduceMotionRef.current = !!v;
        setReduceMotion(!!v);
      })
      .catch(() => {});
    const sub: any = (AccessibilityInfo as any).addEventListener?.('reduceMotionChanged', (v: boolean) => {
      reduceMotionRef.current = !!v;
      setReduceMotion(!!v);
    });
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  const activeIndexSV = useSharedValue(0);
  const layoutsSV = useSharedValue<Array<{ x: number; width: number }>>([]);
  const layoutsRef = React.useRef<Record<string, { x: number; width: number }>>({});

  const onItemLayout = React.useCallback(
    (key: K) =>
      (e: LayoutChangeEvent) => {
        const { x, width } = e.nativeEvent.layout;
        layoutsRef.current[String(key)] = { x, width };
        const next = items
          .map((it) => layoutsRef.current[String(it.key)])
          .filter((v): v is { x: number; width: number } => !!v && Number.isFinite(v.x) && Number.isFinite(v.width));
        if (next.length === items.length) layoutsSV.value = next;
      },
    [items, layoutsSV]
  );

  React.useEffect(() => {
    const idx = Math.max(0, items.findIndex((t) => t.key === value));
    if (reduceMotion) {
      activeIndexSV.value = idx;
      return;
    }
    activeIndexSV.value = withTiming(idx, { duration: 210, easing: Easing.out(Easing.cubic) });
  }, [activeIndexSV, items, reduceMotion, value]);

  const indicatorStyle = useAnimatedStyle(() => {
    const layouts = layoutsSV.value;
    if (!layouts || layouts.length !== items.length) return { opacity: 0 };
    const xs = layouts.map((l) => l.x);
    const ws = layouts.map((l) => l.width);
    const idxs = layouts.map((_, i) => i);
    const x = interpolate(activeIndexSV.value, idxs, xs, Extrapolation.CLAMP);
    const w = interpolate(activeIndexSV.value, idxs, ws, Extrapolation.CLAMP);
    return { opacity: 1, width: w, transform: [{ translateX: x }] };
  });

  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: 'rgba(148,163,184,0.10)',
        padding: 6,
        flexDirection: 'row',
      }}
    >
      {/* Sliding pill indicator */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 6,
            left: 0,
            height,
            backgroundColor: t.color.brand,
            borderRadius: 999,
          },
          indicatorStyle,
        ]}
      />

      {items.map((it, i) => (
        <SegmentButton
          key={it.key}
          label={it.label}
          index={i}
          height={height}
          activeIndexSV={activeIndexSV}
          inactiveColor={t.color.muted}
          active={it.key === value}
          onPress={() => onChange(it.key)}
          onLayout={onItemLayout(it.key)}
        />
      ))}
    </View>
  );
}

