import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { TotlText } from '@totl/ui';

import { PLAYERS_COLORS, PLAYERS_FONTS } from '../retroPlayers/playersTheme';

const TILE_GREEN = require('../../../assets/players/players-tile-green.png');
const WORD_THE = Asset.fromModule(require('../../../assets/players/players-home-the.svg')).uri;
const WORD_PLAYERS = Asset.fromModule(require('../../../assets/players/players-home-players.svg')).uri;

/** The pattern tile is 163.73pt; on these cards it is drawn at 68.38pt. */
const TILE_SCALE = 68.377 / 163.73;
const TILE_OFFSET = { x: -17.09, y: -30.29 };
const TILE_FIELD = { width: 1000, height: 420 };

const THE = { width: 50.3632, height: 30.5087 };
const PLAYERS = { width: 128.001, height: 30.5087 };

export type PlayersHomeCardSize = 'square' | 'wide';

/**
 * Home entry to The Players (Figma 113:26733 square, 113:26815 wide).
 * Streak shows from 1 day; the all-time rank shows once the player has a score.
 */
export default function PlayersHomeCard({
  size,
  streak,
  rank,
  onPress,
}: {
  size: PlayersHomeCardSize;
  streak: number;
  rank: number | null;
  onPress: () => void;
}) {
  const wide = size === 'wide';
  const label = [
    'The Players, daily quiz',
    streak >= 1 ? `${streak} day streak` : null,
    rank ? `ranked ${rank}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { height: wide ? 92 : 143, opacity: pressed ? 0.92 : 1 }]}
    >
      <Image
        source={TILE_GREEN}
        resizeMode="repeat"
        fadeDuration={0}
        style={[
          styles.tiles,
          {
            left: TILE_OFFSET.x,
            top: TILE_OFFSET.y,
            width: TILE_FIELD.width,
            height: TILE_FIELD.height,
            transform: [{ scale: TILE_SCALE }],
          },
        ]}
      />

      <View style={{ position: 'absolute', left: 16, top: 16 }} pointerEvents="none">
        <SvgUri uri={WORD_THE} width={THE.width} height={THE.height} />
      </View>
      <View
        style={{ position: 'absolute', left: wide ? 75.5 : 16, top: wide ? 16 : 53.2 }}
        pointerEvents="none"
      >
        <SvgUri uri={WORD_PLAYERS} width={PLAYERS.width} height={PLAYERS.height} />
      </View>

      <TotlText style={[styles.dailyQuiz, { top: wide ? 53.2 : 96.2 }]}>Daily Quiz</TotlText>

      {streak >= 1 ? (
        <View style={styles.streak}>
          <TotlText style={styles.flame}>🔥</TotlText>
          <TotlText style={styles.streakCount}>{streak}</TotlText>
        </View>
      ) : null}

      {rank ? (
        <View style={styles.rank}>
          <Ionicons name="globe-outline" size={14} color={PLAYERS_COLORS.white} />
          {/* System font, as in the design's SF Pro pill. */}
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#034337',
  },
  tiles: {
    position: 'absolute',
    transformOrigin: 'top left',
  },
  dailyQuiz: {
    position: 'absolute',
    left: 15,
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 16,
    lineHeight: 19.09,
    letterSpacing: -0.048,
    color: PLAYERS_COLORS.white,
  },
  streak: {
    position: 'absolute',
    right: 12,
    top: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flame: {
    fontSize: 13,
    lineHeight: 18,
  },
  streakCount: {
    marginLeft: 2,
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.042,
    color: PLAYERS_COLORS.white,
  },
  rank: {
    position: 'absolute',
    right: 12.3,
    bottom: 12,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PLAYERS_COLORS.brand,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.042,
    color: PLAYERS_COLORS.white,
  },
});
