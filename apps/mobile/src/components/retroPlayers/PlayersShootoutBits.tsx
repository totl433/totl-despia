import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText } from '@totl/ui';
import type { PlayersShootout, PlayersShootoutPerson } from '@totl/api-client';

import { shootoutSides, shootoutStatusLine } from '../../lib/retroPlayers/shootout';
import { PLAYERS_COLORS, PLAYERS_FONTS } from './playersTheme';

/** Pieces shared by the Shootout screens, in The Players' look (paper, brand green, Tourney + Gramatika). */


/** Top bar: back on the left, matching the game's close button placement. */
export function ShootoutTopBar({
  onBack,
  icon = 'chevron-back',
  color = PLAYERS_COLORS.inkSoft,
  title,
}: {
  onBack: () => void;
  icon?: 'chevron-back' | 'close';
  color?: string;
  /** Centred in the bar, e.g. "Round 1 of 3". */
  title?: string;
}) {
  return (
    <View style={styles.topBar}>
      {title ? (
        <View pointerEvents="none" style={styles.topTitleWrap}>
          <TotlText accessibilityRole="header" style={styles.topTitle} numberOfLines={1}>
            {title}
          </TotlText>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={icon === 'close' ? 'Close' : 'Back'}
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name={icon} size={24} color={color} />
      </Pressable>
    </View>
  );
}

/** Tourney kicker + title, as on the game's intro card. */
export function ShootoutTitle({ kicker, title, color = PLAYERS_COLORS.ink }: { kicker?: string; title: string; color?: string }) {
  return (
    <View>
      {kicker ? <TotlText style={[styles.kicker, { color: PLAYERS_COLORS.brand }]}>{kicker}</TotlText> : null}
      <TotlText accessibilityRole="header" style={[styles.title, { color }]}>
        {title}
      </TotlText>
    </View>
  );
}

export function ShootoutAvatar({ person, size = 40 }: { person: PlayersShootoutPerson | { name: string; avatarUrl: string | null }; size?: number }) {
  const initial = person.name.trim().charAt(0).toUpperCase() || '?';
  if (person.avatarUrl) {
    return <Image source={{ uri: person.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: PLAYERS_COLORS.brand,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* An explicit line height so big initials aren't clipped at the top. */}
      <TotlText
        style={{
          fontFamily: PLAYERS_FONTS.medium,
          fontSize: size * 0.42,
          lineHeight: size * 0.56,
          textAlign: 'center',
          color: PLAYERS_COLORS.white,
        }}
      >
        {initial}
      </TotlText>
    </View>
  );
}

/**
 * Whether each Shootout was your move when the list last showed it, kept across
 * remounts (leaving the list and coming back), so the badge only flashes on a change.
 */
const lastYourMove = new Map<string, boolean>();

/** The gold "Your go" badge; flashes a few times when a Shootout turns to your move while you're looking. */
function YourGoBadge({ id, yourMove }: { id: string; yourMove: boolean }) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  React.useEffect(() => {
    const before = lastYourMove.get(id);
    lastYourMove.set(id, yourMove);
    // Only when it turns to you, not the first time the list shows it.
    if (!yourMove || before !== false) return;
    opacity.value = withRepeat(withSequence(withTiming(0.25, { duration: 220 }), withTiming(1, { duration: 220 })), 4);
    scale.value = withRepeat(withSequence(withTiming(1.12, { duration: 220 }), withTiming(1, { duration: 220 })), 4);
  }, [id, opacity, scale, yourMove]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.badge, { backgroundColor: PLAYERS_COLORS.goldEnd }, style]}>
      <TotlText style={[styles.badgeText, { color: PLAYERS_COLORS.ink }]}>Your go</TotlText>
    </Animated.View>
  );
}

/** A challenge in the Shootout home lists. */
export function ShootoutRow({
  challenge,
  now,
  onPress,
  onEnd,
}: {
  challenge: PlayersShootout;
  now: number;
  onPress: () => void;
  /** Shootouts still waiting or in play: the X that ends it (the screen confirms first). */
  onEnd?: () => void;
}) {
  const live = challenge.status === 'active' || challenge.status === 'finished';
  const yourMove = challenge.nextAction === 'play' || challenge.nextAction === 'respond';
  // Note it while it's their move too, so the flip to yours is spotted.
  if (!yourMove && challenge.status === 'active') lastYourMove.set(challenge.id, false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Shootout with ${challenge.them.name}. ${shootoutStatusLine(challenge, now)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, yourMove && styles.rowHot, { opacity: pressed ? 0.85 : 1 }]}
    >
      <ShootoutAvatar person={challenge.them} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TotlText style={styles.rowName} numberOfLines={1}>
          {challenge.them.name}
        </TotlText>
        <TotlText style={[styles.rowStatus, yourMove && { color: PLAYERS_COLORS.brand }]} numberOfLines={2}>
          {shootoutStatusLine(challenge, now)}
        </TotlText>
      </View>
      {live ? (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <TotlText style={styles.rowScore}>
            {challenge.score.me}–{challenge.score.them}
          </TotlText>
          {challenge.result ? (
            <View style={[styles.badge, { backgroundColor: challenge.result === 'won' ? PLAYERS_COLORS.brand : PLAYERS_COLORS.red }]}>
              <TotlText style={styles.badgeText}>{challenge.result === 'won' ? 'Won' : 'Lost'}</TotlText>
            </View>
          ) : yourMove ? (
            <YourGoBadge id={challenge.id} yourMove={yourMove} />
          ) : null}
        </View>
      ) : yourMove ? (
        <View style={[styles.badge, { backgroundColor: PLAYERS_COLORS.goldEnd }]}>
          <TotlText style={[styles.badgeText, { color: PLAYERS_COLORS.ink }]}>Reply</TotlText>
        </View>
      ) : null}
      {onEnd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`End the Shootout with ${challenge.them.name}`}
          onPress={onEnd}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 2 })}
        >
          <Ionicons name="close" size={22} color={PLAYERS_COLORS.muted} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={PLAYERS_COLORS.muted} />
      )}
    </Pressable>
  );
}

export function ShootoutSectionLabel({ children }: { children: string }) {
  return <TotlText style={styles.section}>{children}</TotlText>;
}

const styles = StyleSheet.create({
  // Icon 15pt from the top at 24pt, as in the game and the Scoreboard.
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 15,
    paddingHorizontal: 16,
  },
  // Centred on the 24pt icon, tall enough for the Tourney title's line height.
  topTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 15 + 12 - 19,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 28,
    lineHeight: 30,
    paddingTop: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.brand,
  },
  kicker: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 56,
    lineHeight: 52,
    paddingTop: 6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PLAYERS_COLORS.mist,
    backgroundColor: PLAYERS_COLORS.paper,
  },
  rowHot: {
    borderColor: PLAYERS_COLORS.brand,
    borderWidth: 1.5,
  },
  rowName: {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 17,
    lineHeight: 22,
    color: PLAYERS_COLORS.inkSoft,
  },
  rowStatus: {
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 14,
    lineHeight: 19,
    color: PLAYERS_COLORS.muted,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.white,
  },
  rowScore: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 28,
    lineHeight: 30,
    color: PLAYERS_COLORS.inkSoft,
  },
  section: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.muted,
    marginTop: 8,
  },
});

/**
 * The score at the top of a match screen: home photo, the score in The Players'
 * display font, away photo. Challenger home on the left.
 */
export function ShootoutScoreHeader({ challenge }: { challenge: PlayersShootout }) {
  const sides = shootoutSides(challenge);
  return (
    <View
      accessible
      accessibilityLabel={`${sides.home.name} ${sides.homeScore}, ${sides.away.name} ${sides.awayScore}`}
      style={headerStyles.row}
    >
      <ShootoutAvatar person={sides.home} size={32} />
      <TotlText style={headerStyles.score}>
        {sides.homeScore}–{sides.awayScore}
      </TotlText>
      <ShootoutAvatar person={sides.away} size={32} />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  // No fixed height, and room above the glyphs: Tourney's tops get clipped otherwise.
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  score: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 34,
    lineHeight: 40,
    paddingTop: 6,
    color: PLAYERS_COLORS.white,
  },
});
