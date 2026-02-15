import React from 'react';
import { Animated, Easing, Image, View } from 'react-native';
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
  ring,
  isMe,
  overlap,
  shiny = false,
}: {
  name: string;
  avatarUri?: string | null;
  ring: string;
  isMe: boolean;
  overlap: number;
  shiny?: boolean;
}) {
  const t = useTokens();
  const SIZE = 28;
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: 999,
        backgroundColor: t.color.surface2,
        borderWidth: shiny ? 0 : isMe ? 2 : 1,
        borderColor: isMe ? t.color.brand : ring,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: overlap,
        overflow: 'hidden',
        shadowColor: '#000000',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: SIZE, height: SIZE }} resizeMode="cover" />
      ) : (
        <TotlText variant="caption" style={{ fontWeight: '900' }}>
          {initial1(name)}
        </TotlText>
      )}
      {shiny ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(250,204,21,0.14)',
            }}
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
}: {
  members: Array<{ id: string; name: string; avatar_url?: string | null }>;
  picksByUserId: Map<string, LeaguePick>;
  outcome: LeaguePick | null;
  currentUserId: string | null;
}) {
  const t = useTokens();

  const byPick = React.useMemo(() => {
    const m = new Map<LeaguePick, Array<{ id: string; name: string; avatar_url?: string | null }>>([
      ['H', []],
      ['D', []],
      ['A', []],
    ]);
    members.forEach((mem) => {
      const p = picksByUserId.get(mem.id);
      if (!p) return;
      m.get(p)!.push({ id: mem.id, name: mem.name, avatar_url: mem.avatar_url ?? null });
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
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: align }}>
        {arr.map((u, idx) => (
          <Chip
            key={u.id}
            name={u.name}
            avatarUri={u.avatar_url ?? null}
            ring={ringFor(pick)}
            isMe={!!currentUserId && u.id === currentUserId}
            overlap={idx === 0 ? 0 : -8}
            shiny={!!outcome && pick === outcome}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>{renderBucket('H', 'flex-end')}</View>
        <View style={{ width: 84, alignItems: 'center' }}>{renderBucket('D', 'center')}</View>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>{renderBucket('A', 'flex-start')}</View>
      </View>
    </View>
  );
}

