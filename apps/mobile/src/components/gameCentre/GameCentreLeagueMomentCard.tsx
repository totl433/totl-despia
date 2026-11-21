import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';

import type { FeedFace } from '../../features/matchCenter/feed';
import { EVERYONE_IN_AVATAR, everyoneInLayout } from './everyoneInLayout';

/**
 * Mini league moments (Figma 451:61161 D03 Everyone has predicted, 452:73571 D04 Player joined):
 * a cream card with the league's name, a line, the faces, and "Go to mini league".
 */
export const LEAGUE_MOMENT_CARD = {
  background: '#FFF8EB',
  border: '#FFE3B0',
  avatar: '#FFCC8A',
  text: '#37373D',
  green: '#0A635A',
};

/** One slow turn of the D03 badge, like the label on a record. */
const TURN_MS = 16_000;
/** D04: the new player and the badge, overlapping by 24pt. */
const JOINED_AVATAR = 64;
const JOINED_OVERLAP = 24;

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function Member({ face, size }: { face: FeedFace; size: number }) {
  const t = useTokens();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: LEAGUE_MOMENT_CARD.avatar,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {face.avatarUrl ? (
        <Image source={{ uri: face.avatarUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <TotlText style={{ fontFamily: t.font.medium, fontSize: 24, lineHeight: 28, color: LEAGUE_MOMENT_CARD.text }}>{initial(face.name)}</TotlText>
      )}
    </View>
  );
}

/** The league badge. With `spin` it turns slowly while on screen (and stays still with Reduce Motion on). */
function LeagueBadge({ uri, name, size, spin = false }: { uri: string | null; name: string; size: number; spin?: boolean }) {
  const t = useTokens();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  React.useEffect(() => {
    if (!spin || reduceMotion) return undefined;
    turn.value = withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduceMotion, spin, turn]);
  const turning = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: LEAGUE_MOMENT_CARD.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        turning,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <TotlText style={{ fontFamily: t.font.medium, fontSize: 24, lineHeight: 28, color: LEAGUE_MOMENT_CARD.green }}>{initial(name)}</TotlText>
      )}
    </Animated.View>
  );
}

/** The shared shell: header, the faces, then the outlined "Go to mini league" button. */
function LeagueMomentCard({
  title,
  line,
  summary,
  buttonLabel,
  onPress,
  children,
}: {
  title: string;
  line?: string | null;
  /** Read out with the header, describing the faces (which screen readers skip). */
  summary: string;
  buttonLabel: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <View
      style={{
        backgroundColor: LEAGUE_MOMENT_CARD.background,
        borderWidth: 1,
        borderColor: LEAGUE_MOMENT_CARD.border,
        borderRadius: 16,
        paddingTop: 20,
        gap: 28,
      }}
    >
      <View style={{ paddingHorizontal: 16, gap: 8 }} accessible accessibilityLabel={[title, line, summary].filter(Boolean).join('. ')}>
        <TotlText accessibilityRole="header" style={{ fontFamily: t.font.regular, fontSize: 22, lineHeight: 26, letterSpacing: 0.22, color: LEAGUE_MOMENT_CARD.text }}>
          {title}
        </TotlText>
        {line ? (
          <TotlText style={{ fontFamily: t.font.regular, fontSize: 16, lineHeight: 20, letterSpacing: 0.16, color: LEAGUE_MOMENT_CARD.text }}>{line}</TotlText>
        ) : null}
      </View>
      <View style={{ alignItems: 'center' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {children as any}
      </View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${buttonLabel}: ${title}`}
          onPress={onPress}
          style={({ pressed }) => ({
            height: 40,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: LEAGUE_MOMENT_CARD.green,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <TotlText style={{ fontFamily: t.font.medium, fontSize: 16, lineHeight: 16, color: LEAGUE_MOMENT_CARD.green }}>{buttonLabel}</TotlText>
        </Pressable>
      </View>
    </View>
  );
}

/** D03 Everyone has predicted (Figma 451:61161): every member ringed around the turning league badge. */
export function EveryoneInFeedCard({
  title,
  line,
  badgeUrl,
  faces,
  buttonLabel,
  onPress,
}: {
  /** The mini league's name. */
  title: string;
  line?: string | null;
  badgeUrl: string | null;
  faces: FeedFace[];
  buttonLabel: string;
  onPress: () => void;
}) {
  const shown = faces.slice(0, 8);
  const layout = everyoneInLayout(shown.length);
  return (
    <LeagueMomentCard
      title={title}
      line={line}
      summary={`${shown.length} players: ${shown.map((face) => face.name).join(', ')}`}
      buttonLabel={buttonLabel}
      onPress={onPress}
    >
      <View style={{ width: layout.width, height: layout.height }}>
        {shown.map((face, index) => (
          <View key={`${face.name}-${index}`} style={{ position: 'absolute', left: layout.avatars[index]!.x, top: layout.avatars[index]!.y }}>
            <Member face={face} size={EVERYONE_IN_AVATAR} />
          </View>
        ))}
        <View style={{ position: 'absolute', left: layout.badge.x, top: layout.badge.y }}>
          <LeagueBadge uri={badgeUrl} name={title} size={EVERYONE_IN_AVATAR} spin />
        </View>
      </View>
    </LeagueMomentCard>
  );
}

/** D04 Player joined (Figma 452:73571): the new player's face over the league badge. */
export function PlayerJoinedFeedCard({
  title,
  line,
  badgeUrl,
  person,
  buttonLabel,
  onPress,
}: {
  /** The mini league's name. */
  title: string;
  line?: string | null;
  badgeUrl: string | null;
  person: FeedFace;
  buttonLabel: string;
  onPress: () => void;
}) {
  return (
    <LeagueMomentCard title={title} line={line} summary={`${person.name} joined`} buttonLabel={buttonLabel} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ marginRight: -JOINED_OVERLAP, zIndex: 2 }}>
          <Member face={person} size={JOINED_AVATAR} />
        </View>
        <View style={{ zIndex: 1 }}>
          <LeagueBadge uri={badgeUrl} name={title} size={JOINED_AVATAR} />
        </View>
      </View>
    </LeagueMomentCard>
  );
}
