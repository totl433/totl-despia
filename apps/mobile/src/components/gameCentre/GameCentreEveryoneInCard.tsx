import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';

import type { FeedFace } from '../../features/matchCenter/feed';
import { EVERYONE_IN_AVATAR as AVATAR, everyoneInLayout } from './everyoneInLayout';

/** Figma 451:61161 (D03 Everyone has predicted): cream card, members ringed around the league badge. */
export const EVERYONE_IN_CARD = {
  background: '#FFF8EB',
  border: '#FFE3B0',
  avatar: '#FFCC8A',
  text: '#37373D',
  green: '#0A635A',
};

/** One slow turn of the badge, like the label on a record. */
const TURN_MS = 16_000;

function Member({ face }: { face: FeedFace }) {
  const t = useTokens();
  const letter = face.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: AVATAR,
        height: AVATAR,
        borderRadius: AVATAR / 2,
        overflow: 'hidden',
        backgroundColor: EVERYONE_IN_CARD.avatar,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {face.avatarUrl ? (
        <Image source={{ uri: face.avatarUrl }} style={{ width: AVATAR, height: AVATAR }} resizeMode="cover" />
      ) : (
        <TotlText style={{ fontFamily: t.font.medium, fontSize: 24, lineHeight: 28, color: EVERYONE_IN_CARD.text }}>{letter}</TotlText>
      )}
    </View>
  );
}

/** The league badge, turning slowly for as long as the card is on screen (still with Reduce Motion on). */
function SpinningBadge({ uri, name }: { uri: string | null; name: string }) {
  const t = useTokens();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  React.useEffect(() => {
    if (reduceMotion) return undefined;
    turn.value = withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View
      style={[
        {
          width: AVATAR,
          height: AVATAR,
          borderRadius: AVATAR / 2,
          overflow: 'hidden',
          backgroundColor: EVERYONE_IN_CARD.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        spin,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: AVATAR, height: AVATAR }} resizeMode="cover" />
      ) : (
        <TotlText style={{ fontFamily: t.font.medium, fontSize: 24, lineHeight: 28, color: EVERYONE_IN_CARD.green }}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </TotlText>
      )}
    </Animated.View>
  );
}

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
  const t = useTokens();
  const shown = faces.slice(0, 8);
  const layout = everyoneInLayout(shown.length);
  return (
    <View
      style={{
        backgroundColor: EVERYONE_IN_CARD.background,
        borderWidth: 1,
        borderColor: EVERYONE_IN_CARD.border,
        borderRadius: 16,
        paddingTop: 20,
        gap: 28,
      }}
    >
      <View
        style={{ paddingHorizontal: 16, gap: 8 }}
        accessible
        accessibilityLabel={[title, line, `${shown.length} players: ${shown.map((face) => face.name).join(', ')}`].filter(Boolean).join('. ')}
      >
        <TotlText accessibilityRole="header" style={{ fontFamily: t.font.regular, fontSize: 22, lineHeight: 26, letterSpacing: 0.22, color: EVERYONE_IN_CARD.text }}>
          {title}
        </TotlText>
        {line ? (
          <TotlText style={{ fontFamily: t.font.regular, fontSize: 16, lineHeight: 20, letterSpacing: 0.16, color: EVERYONE_IN_CARD.text }}>{line}</TotlText>
        ) : null}
      </View>
      <View style={{ alignItems: 'center' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={{ width: layout.width, height: layout.height }}>
          {shown.map((face, index) => (
            <View key={`${face.name}-${index}`} style={{ position: 'absolute', left: layout.avatars[index]!.x, top: layout.avatars[index]!.y }}>
              <Member face={face} />
            </View>
          ))}
          <View style={{ position: 'absolute', left: layout.badge.x, top: layout.badge.y }}>
            <SpinningBadge uri={badgeUrl} name={title} />
          </View>
        </View>
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
            borderColor: EVERYONE_IN_CARD.green,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <TotlText style={{ fontFamily: t.font.medium, fontSize: 16, lineHeight: 16, color: EVERYONE_IN_CARD.green }}>{buttonLabel}</TotlText>
        </Pressable>
      </View>
    </View>
  );
}
