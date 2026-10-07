import React from 'react';
import { AccessibilityInfo, Pressable, type LayoutChangeEvent, Text, View } from 'react-native';
import { useTokens } from '@totl/ui';
import { useThemePreference } from '../../context/ThemePreferenceContext';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type LeagueTabKey = 'gwTable' | 'predictions' | 'season';

const AnimatedText = Animated.createAnimatedComponent(Text);

function LiveDot() {
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withRepeat(withTiming(1.35, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.35], [1, 0.55], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 999,
          backgroundColor: '#DC2626',
          marginRight: 6,
        },
        style,
      ]}
    />
  );
}

function TabButton({
  label,
  index,
  activeIndexSV,
  activeColor,
  inactiveColor,
  showLiveDot = false,
  onPress,
  onLayout,
}: {
  label: string;
  index: number;
  activeIndexSV: { value: number };
  activeColor: string;
  inactiveColor: string;
  showLiveDot?: boolean;
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
      accessibilityRole="tab"
      accessibilityLabel={showLiveDot ? `${label}, live` : label}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {showLiveDot ? <LiveDot /> : null}
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
      </View>
    </Pressable>
  );
}

export default function LeagueTabBar({
  value,
  onChange,
  gwTableLabel = 'GW Table',
  gwTableLive = false,
}: {
  value: LeagueTabKey;
  onChange: (next: LeagueTabKey) => void;
  /** e.g. "GW4 Table" while a numbered gameweek is selected. */
  gwTableLabel?: string;
  /** Red live dot to the left of the GW Table tab. */
  gwTableLive?: boolean;
}) {
  const t = useTokens();
  const { isDark } = useThemePreference();
  const inactiveColor = isDark ? '#F8FAFC' : t.color.text;
  const TAB_ANIM_MS = 210;
  const INDICATOR_H = 2;
  const tabs: Array<{ key: LeagueTabKey; label: string; live?: boolean }> = React.useMemo(
    () => [
      { key: 'gwTable', label: gwTableLabel, live: gwTableLive },
      { key: 'predictions', label: 'Predictions' },
      { key: 'season', label: 'Season' },
    ],
    [gwTableLabel, gwTableLive]
  );

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
    (tabKey: LeagueTabKey) =>
      (e: LayoutChangeEvent) => {
        const { x, width } = e.nativeEvent.layout;
        layoutsRef.current[tabKey] = { x, width };
        const next = tabs
          .map((tab) => layoutsRef.current[tab.key])
          .filter((v): v is { x: number; width: number } => !!v && Number.isFinite(v.x) && Number.isFinite(v.width));
        if (next.length === tabs.length) layoutsSV.value = next;
      },
    [layoutsSV, tabs]
  );

  React.useEffect(() => {
    const idx = Math.max(0, tabs.findIndex((tab) => tab.key === value));
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
            inactiveColor={inactiveColor}
            showLiveDot={!!tab.live}
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
