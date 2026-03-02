import React, { useEffect } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import Reanimated, {
  Easing as ReanimatedEasing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';
import { LinearGradient } from 'expo-linear-gradient';

import type { LeaguePick } from './LeaguePickPill';

function initial1(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] ?? '?').toUpperCase();
}

function SmoothChipShimmer() {
  const anim = React.useRef(new Animated.Value(0)).current;
  const [w, setW] = React.useState(0);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const width = w || 28;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 1.4, width * 1.4],
  });

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: -10,
          bottom: -10,
          width: Math.max(18, width * 0.7),
          transform: [{ translateX }, { rotate: '14deg' }],
          opacity: 0.56,
        }}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.94)', 'rgba(255,255,255,0.00)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

function Chip({
  name,
  avatarUri,
  avatarBgColor,
  ring,
  isMe,
  overlap,
  shiny = false,
  size = 34,
  compactSV,
  expandedSize,
}: {
  name: string;
  avatarUri?: string | null;
  avatarBgColor?: string | null;
  ring: string;
  isMe: boolean;
  overlap: number;
  shiny?: boolean;
  size?: number;
  compactSV?: SharedValue<number>;
  expandedSize?: number;
}) {
  const t = useTokens();
  const SIZE = size;
  const targetSize = expandedSize ?? size;
  const defaultSV = useSharedValue(0);
  const sv = compactSV ?? defaultSV;
  const chipStyle = useAnimatedStyle(() => {
    const s = interpolate(sv.value, [0, 1], [targetSize, 22]);
    return { width: s, height: s, marginLeft: overlap };
  });
  const baseStyle = {
    borderRadius: 999,
    backgroundColor: avatarUri ? t.color.surface2 : (avatarBgColor ?? t.color.surface2),
    borderWidth: shiny ? 0 : isMe ? 2 : 1,
    borderColor: isMe ? t.color.brand : ring,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  };
  if (compactSV) {
    return (
      <Reanimated.View style={[baseStyle, chipStyle]}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <TotlText variant="caption" style={{ fontWeight: '900', color: '#FFFFFF' }}>
            {initial1(name)}
          </TotlText>
        )}
        {shiny ? (
          <>
            <View
              pointerEvents="none"
              style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(250,204,21,0.14)' }}
            />
            <SmoothChipShimmer />
          </>
        ) : null}
      </Reanimated.View>
    );
  }
  return (
    <View style={[baseStyle, { width: SIZE, height: SIZE, marginLeft: overlap }]}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: SIZE, height: SIZE }} resizeMode="cover" />
      ) : (
        <TotlText variant="caption" style={{ fontWeight: '900', color: '#FFFFFF' }}>
          {initial1(name)}
        </TotlText>
      )}
      {shiny ? (
        <>
          <View
            pointerEvents="none"
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(250,204,21,0.14)' }}
          />
          <SmoothChipShimmer />
        </>
      ) : null}
    </View>
  );
}

/**
 * LeaguePickChipsRow
 * Renders member “chips” under a fixture, bucketed by pick (H / D / A) like the web UI.
 */
export default function LeaguePickChipsRow({
  members,
  picksByUserId,
  outcome,
  currentUserId,
  compact = false,
}: {
  members: Array<{ id: string; name: string; avatar_url?: string | null; avatar_bg_color?: string | null }>;
  picksByUserId: Map<string, LeaguePick>;
  outcome: LeaguePick | null;
  currentUserId: string | null;
  compact?: boolean;
}) {
  const t = useTokens();
  const compactSV = useSharedValue(compact ? 1 : 0);
  useEffect(() => {
    compactSV.value = withTiming(compact ? 1 : 0, { duration: 200, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
  }, [compact, compactSV]);

  const byPick = React.useMemo(() => {
    const m = new Map<LeaguePick, Array<{ id: string; name: string; avatar_url?: string | null; avatar_bg_color?: string | null }>>([
      ['H', []],
      ['D', []],
      ['A', []],
    ]);
    members.forEach((mem) => {
      const p = picksByUserId.get(mem.id);
      if (!p) return;
      m.get(p)!.push({
        id: mem.id,
        name: mem.name,
        avatar_url: mem.avatar_url ?? null,
        avatar_bg_color: mem.avatar_bg_color ?? null,
      });
    });
    return m;
  }, [members, picksByUserId]);

  const ringFor = (p: LeaguePick) => {
    if (!outcome) return t.color.border;
    return p === outcome ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.70)';
  };

  const renderBucket = (pick: LeaguePick, align: 'flex-start' | 'center' | 'flex-end') => {
    const arr = byPick.get(pick) ?? [];
    if (!arr.length) return <View style={{ height: 28 }} />;
    const everyonePickedThis = members.length > 0 && arr.length === members.length;
    const stackedOverlap = compact ? -19 : -20;
    const defaultOverlap = compact ? -10 : -8;
    const chipSize = everyonePickedThis ? (compact ? 22 : 30) : compact ? 22 : 34;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: align, maxWidth: '100%' }}>
        {arr.map((u, idx) => (
          <Chip
            key={u.id}
            name={u.name}
            avatarUri={u.avatar_url ?? null}
            avatarBgColor={u.avatar_bg_color ?? null}
            ring={ringFor(pick)}
            isMe={!!currentUserId && u.id === currentUserId}
            overlap={idx === 0 ? 0 : everyonePickedThis ? stackedOverlap : defaultOverlap}
            shiny={!!outcome && pick === outcome}
            size={chipSize}
            compactSV={compactSV}
            expandedSize={chipSize}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={{ paddingHorizontal: compact ? 2 : 8, paddingBottom: compact ? 2 : 12, paddingTop: compact ? 0 : 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>{renderBucket('H', 'center')}</View>
        <View style={{ flex: 1, alignItems: 'center' }}>{renderBucket('D', 'center')}</View>
        <View style={{ flex: 1, alignItems: 'center' }}>{renderBucket('A', 'center')}</View>
      </View>
    </View>
  );
}

