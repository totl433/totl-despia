import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText } from '@totl/ui';
import type { PlayersShootout } from '@totl/api-client';

import { shootoutSides, type ShootoutCardSpec } from '../../lib/retroPlayers/shootout';
import { PlayersButton, PlayersTextLink } from './PlayersControls';
import PlayersPatternCard from './PlayersPatternCard';
import { ShootoutAvatar, ShootoutScoreHeader } from './PlayersShootoutBits';
import { PLAYERS_CARD, PLAYERS_COLORS, PLAYERS_FONTS } from './playersTheme';

/**
 * Where the Shootout's full-size cards sit: placed and sized like the daily game's
 * question and reveal cards (44pt bar + 92pt header above, 40pt gap and a 93pt slot below).
 */
export function useShootoutCardLayout() {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const HEADER_H = 44 + 92;
  const GAP = 40;
  const SLOT_H = 93;
  const cardTop = insets.top + HEADER_H;
  const bottomReserve = GAP + SLOT_H + Math.max(insets.bottom, 16) + 12;
  const maxCardW = Math.min(353, screenW - PLAYERS_CARD.sideInset * 2);
  const maxCardH = Math.max(320, screenH - cardTop - bottomReserve);
  const cardH = Math.min(maxCardW / PLAYERS_CARD.aspectRatio, maxCardH);
  const cardW = cardH * PLAYERS_CARD.aspectRatio;
  return { HEADER_H, GAP, SLOT_H, cardW, cardH, s: cardW / 353 };
}

/** The turn card's title, at the size of the daily intro card's "THE PLAYERS" (93.75 on the 353pt card). */
const TURN_TITLE = 84;

/** The X, top right of every navy Shootout screen. */
export function ShootoutCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to Shootouts"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name="close" size={24} color={PLAYERS_COLORS.white} />
    </Pressable>
  );
}

/**
 * A Shootout between cards, on navy like the daily game: "Best of three" over a
 * status line, one full-size card, then a button (or whose move it is) underneath.
 * What it says comes from shootoutCardSpec, so it reads right to either player.
 */
export default function ShootoutCardScreen({
  challenge,
  spec,
  busy = false,
  message,
  onClose,
  onPrimary,
  onLink,
}: {
  challenge: PlayersShootout;
  spec: ShootoutCardSpec;
  busy?: boolean;
  message?: string | null;
  onClose: () => void;
  onPrimary: () => void;
  onLink: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { HEADER_H, GAP, SLOT_H, cardW, cardH, s } = useShootoutCardLayout();
  const sides = shootoutSides(challenge);

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={{ height: HEADER_H, alignItems: 'center', paddingTop: 17 }}>
        <ShootoutCloseButton onPress={onClose} />
        {spec.body === 'turn' ? (
          <ShootoutScoreHeader challenge={challenge} />
        ) : (
          <TotlText style={styles.headerLine}>{spec.headerLine}</TotlText>
        )}
        <TotlText style={styles.headerLabel}>{spec.headerLabel}</TotlText>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Animated.View entering={FadeIn.duration(300)} style={{ width: cardW, height: cardH }}>
          <PlayersPatternCard variant="green">
            {spec.body === 'turn' ? (
              // As the daily game's intro card: big title, two lines.
              <View style={[styles.turnBody, { paddingHorizontal: 20 * s, paddingVertical: 26 * s }]}>
                <View style={styles.turnTop}>
                  <TotlText
                    accessibilityRole="header"
                    style={[
                      styles.turnTitle,
                      { fontSize: TURN_TITLE * s, lineHeight: TURN_TITLE * s * 0.86, paddingTop: TURN_TITLE * s * 0.12 },
                    ]}
                  >
                    {spec.title}
                  </TotlText>
                  <View style={{ marginTop: 28 * s, alignItems: 'center' }}>
                    {/* The first line is the news ("Carl has played card 1."): gold and larger, so it's not missed. */}
                    {spec.lines.map((line, i) => (
                      <TotlText
                        key={line}
                        style={[
                          styles.turnLine,
                          i === 0
                            ? { color: PLAYERS_COLORS.goldEnd, fontSize: 24 * s, lineHeight: 30 * s, marginBottom: 8 * s }
                            : { fontSize: 17.94 * s, lineHeight: 26 * s, letterSpacing: 0.18 * s },
                        ]}
                      >
                        {line}
                      </TotlText>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.versusBody, { paddingHorizontal: 22 * s, paddingVertical: 30 * s }]}>
                <TotlText
                  style={[styles.title, { fontSize: 74 * s, lineHeight: 70 * s, paddingTop: 10 * s }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {spec.title}
                </TotlText>
                {/* Challenger home on the left, challenged player away on the right. */}
                <View style={styles.row}>
                  <Player person={sides.home} name={sides.homeIsMe ? 'You' : sides.home.name} size={78 * s} fontSize={17 * s} />
                  <TotlText style={[styles.versus, { fontSize: 56 * s, lineHeight: 56 * s, paddingTop: 8 * s }]}>v</TotlText>
                  <Player person={sides.away} name={sides.homeIsMe ? sides.away.name : 'You'} size={78 * s} fontSize={17 * s} />
                </View>
                {spec.subtitle ? (
                  <TotlText style={[styles.subtitle, { fontSize: 16 * s, lineHeight: 23 * s }]}>{spec.subtitle}</TotlText>
                ) : (
                  <View />
                )}
              </View>
            )}
          </PlayersPatternCard>
        </Animated.View>
      </View>

      <View style={{ marginTop: GAP, width: cardW, alignSelf: 'center', gap: 14 }}>
        {message ? <TotlText style={styles.message}>{message}</TotlText> : null}
        {spec.note ? <TotlText style={styles.note}>{spec.note}</TotlText> : null}
        {spec.primary ? (
          <PlayersButton label={spec.primary.label} arrow height={SLOT_H} busy={busy} onPress={onPrimary} />
        ) : null}
        {spec.link ? (
          <View style={{ alignItems: 'center' }}>
            <PlayersTextLink label={spec.link.label} color={PLAYERS_COLORS.white} onPress={onLink} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Player({
  person,
  name,
  size,
  fontSize,
  width,
}: {
  person: PlayersShootout['me'];
  name: string;
  size: number;
  fontSize: number;
  /** Fixed width beside a score; otherwise an equal share of the row. */
  width?: number;
}) {
  return (
    <View style={[styles.player, width ? { width } : { flex: 1 }]}>
      <ShootoutAvatar person={person} size={size} />
      <TotlText style={[styles.name, { fontSize }]} numberOfLines={1}>
        {name}
      </TotlText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: PLAYERS_COLORS.navy },
  close: { position: 'absolute', right: 16, top: 15, zIndex: 1 },
  headerLine: { fontFamily: PLAYERS_FONTS.medium, fontSize: 24, lineHeight: 30, color: PLAYERS_COLORS.white },
  headerLabel: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 30,
    lineHeight: 32,
    paddingTop: 4,
    marginTop: 6,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.whiteSoft,
  },
  turnBody: { flex: 1 },
  turnTop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  turnTitle: {
    fontFamily: PLAYERS_FONTS.display,
    color: PLAYERS_COLORS.white,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  turnLine: { fontFamily: PLAYERS_FONTS.medium, color: PLAYERS_COLORS.white, textAlign: 'center' },
  versusBody: { flex: 1, justifyContent: 'space-between', alignItems: 'center' },
  title: {
    fontFamily: PLAYERS_FONTS.display,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.goldEnd,
  },
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  player: { alignItems: 'center', gap: 6 },
  name: { fontFamily: PLAYERS_FONTS.medium, color: PLAYERS_COLORS.white },
  versus: { fontFamily: PLAYERS_FONTS.display, color: PLAYERS_COLORS.whiteSoft, textTransform: 'uppercase' },
  subtitle: { fontFamily: PLAYERS_FONTS.body, color: PLAYERS_COLORS.whiteSoft, textAlign: 'center' },
  message: { fontFamily: PLAYERS_FONTS.body, fontSize: 15, color: PLAYERS_COLORS.red, textAlign: 'center' },
  note: { fontFamily: PLAYERS_FONTS.medium, fontSize: 20, lineHeight: 26, color: PLAYERS_COLORS.white, textAlign: 'center' },
});
