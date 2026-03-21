import React from 'react';
import { AccessibilityInfo, Pressable, type LayoutChangeEvent, Text, View } from 'react-native';
import { useTokens } from '@totl/ui';
import Animated, { Easing, Extrapolation, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedText = Animated.createAnimatedComponent(Text);

export type UnderlineTabItem<K extends string> = { key: K; label: string; showLiveDot?: boolean };

function TabButton({
  label,
  index,
  activeIndexSV,
  activeColor,
  inactiveColor,
  onPress,
  onLayout,
  showLiveDot = false,
}: {
  label: string;
  index: number;
  activeIndexSV: { value: number };
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  showLiveDot?: boolean;
}) {
  const t = useTokens();
  const labelStyle = useAnimatedStyle(() => {
    const x = activeIndexSV.value;
    const opacity = interpolate(x, [index - 0.6, index, index + 0.6], [0.75, 1, 0.75], Extrapolation.CLAMP);
    const color = interpolateColor(x, [index - 0.6, index, index + 0.6], [inactiveColor, activeColor, inactiveColor]);
    return { opacity, color };
  });

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {showLiveDot ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: '#EF4444',
            }}
          />
        ) : null}
        <AnimatedText
          style={[
            {
              fontSize: 14,
              lineHeight: 20,
              fontFamily: t.font.medium,
            },
            labelStyle,
          ]}
        >
          {label}
        </AnimatedText>
      </View>
    </Pressable>
  );
}

/**
 * Underline-style tabs matching the leaderboards menu. Flat tabs with animated
 * underline indicator, no pill background.
 */
export default function UnderlineTabs<K extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<UnderlineTabItem<K>>;
  value: K;
  onChange: (next: K) => void;
}) {
  const t = useTokens();
  const TAB_ANIM_MS = 210;
  const INDICATOR_H = 2;

  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (!alive) return;
        setReduceMotion(!!v);
      })
      .catch(() => {});
    const sub: any = (AccessibilityInfo as any).addEventListener?.('reduceMotionChanged', (v: boolean) => {
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

  const onTabLayout = React.useCallback(
    (tabKey: K) =>
      (e: LayoutChangeEvent) => {
        const { x, width } = e.nativeEvent.layout;
        layoutsRef.current[String(tabKey)] = { x, width };
        const next = items
          .map((tab) => layoutsRef.current[String(tab.key)])
          .filter((entry): entry is { x: number; width: number } => !!entry && Number.isFinite(entry.x) && Number.isFinite(entry.width));
        if (next.length === items.length) layoutsSV.value = next;
      },
    [items, layoutsSV]
  );

  React.useEffect(() => {
    const idx = Math.max(0, items.findIndex((item) => item.key === value));
    if (reduceMotion) {
      activeIndexSV.value = idx;
      return;
    }
    activeIndexSV.value = withTiming(idx, { duration: TAB_ANIM_MS, easing: Easing.out(Easing.cubic) });
  }, [activeIndexSV, items, reduceMotion, value]);

  const indicatorStyle = useAnimatedStyle(() => {
    const layouts = layoutsSV.value;
    if (!layouts || layouts.length !== items.length) return { opacity: 0 };
    const xs = layouts.map((layout) => layout.x);
    const ws = layouts.map((layout) => layout.width);
    const idxs = layouts.map((_, i) => i);
    const x = interpolate(activeIndexSV.value, idxs, xs, Extrapolation.CLAMP);
    const w = interpolate(activeIndexSV.value, idxs, ws, Extrapolation.CLAMP);
    return {
      opacity: 1,
      width: w,
      transform: [{ translateX: x }],
    };
  });

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: t.color.border }}>
      <View style={{ flexDirection: 'row' }}>
        {items.map((item, index) => (
          <TabButton
            key={item.key}
            label={item.label}
            showLiveDot={item.showLiveDot}
            index={index}
            activeIndexSV={activeIndexSV}
            activeColor={t.color.brand}
            inactiveColor={t.color.muted}
            onPress={() => onChange(item.key)}
            onLayout={onTabLayout(item.key)}
          />
        ))}
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: INDICATOR_H,
            backgroundColor: t.color.brand,
            borderRadius: 999,
          },
          indicatorStyle,
        ]}
      />
    </View>
  );
}
