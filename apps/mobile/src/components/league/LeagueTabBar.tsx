import React from 'react';
import { AccessibilityInfo, Pressable, type LayoutChangeEvent, Text, View } from 'react-native';
import { useTokens } from '@totl/ui';
import Animated, { Easing, Extrapolation, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export type LeagueTabKey = 'gwTable' | 'predictions' | 'season';

const AnimatedText = Animated.createAnimatedComponent(Text);

function TabButton({
  label,
  index,
  activeIndexSV,
  activeColor,
  inactiveColor,
  onPress,
  onLayout,
}: {
  label: string;
  index: number;
  activeIndexSV: { value: number };
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
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
      <AnimatedText
        style={[
          {
            fontFamily: 'Gramatika-Regular',
            fontSize: 14,
            lineHeight: 20,
            fontWeight: '900',
          },
          labelStyle,
        ]}
      >
        {label}
      </AnimatedText>
    </Pressable>
  );
}

export default function LeagueTabBar({
  value,
  onChange,
}: {
  value: LeagueTabKey;
  onChange: (next: LeagueTabKey) => void;
}) {
  const t = useTokens();
  // How to tweak:
  // - duration/easing: `TAB_ANIM_MS` + easing in the `withTiming` below
  // - indicator height: `INDICATOR_H`
  // - active/inactive colors: `activeColor`/`inactiveColor` passed to TabButton
  const TAB_ANIM_MS = 210; // ~180–240ms (spec)
  const INDICATOR_H = 2;
  const tabs: Array<{ key: LeagueTabKey; label: string }> = [
    { key: 'gwTable', label: 'GW Table' },
    { key: 'predictions', label: 'Predictions' },
    { key: 'season', label: 'Season' },
  ];

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

  // Track layouts in JS for stable ordering -> push into SharedValue for worklets.
  const layoutsRef = React.useRef<Record<string, { x: number; width: number }>>({});
  const onTabLayout = React.useCallback(
    (tabKey: LeagueTabKey) =>
      (e: LayoutChangeEvent) => {
        const { x, width } = e.nativeEvent.layout;
        layoutsRef.current[tabKey] = { x, width };
        const next = tabs
          .map((t) => layoutsRef.current[t.key])
          .filter((v): v is { x: number; width: number } => !!v && Number.isFinite(v.x) && Number.isFinite(v.width));
        if (next.length === tabs.length) layoutsSV.value = next;
      },
    [layoutsSV, tabs]
  );

  // Animate index changes (or jump instantly for Reduce Motion).
  React.useEffect(() => {
    const idx = Math.max(0, tabs.findIndex((t) => t.key === value));
    if (reduceMotion) {
      activeIndexSV.value = idx;
      return;
    }
    activeIndexSV.value = withTiming(idx, { duration: TAB_ANIM_MS, easing: Easing.out(Easing.cubic) });
  }, [activeIndexSV, reduceMotion, tabs, value]);

  const indicatorStyle = useAnimatedStyle(() => {
    const layouts = layoutsSV.value;
    if (!layouts || layouts.length !== tabs.length) return { opacity: 0 };
    const xs = layouts.map((l) => l.x);
    const ws = layouts.map((l) => l.width);
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
        {tabs.map((tab, i) => (
          <TabButton
            key={tab.key}
            label={tab.label}
            index={i}
            activeIndexSV={activeIndexSV}
            activeColor={t.color.brand}
            inactiveColor={t.color.muted}
            onPress={() => onChange(tab.key)}
            onLayout={onTabLayout(tab.key)}
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

