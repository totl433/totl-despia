import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { TotlText } from '@totl/ui';

import type { PlayersCard } from '../../lib/retroPlayers/buildPuzzle';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import type { PlayersRoundOutcome } from './RetroPlayersRevealCard';
import { PlayersButton } from './PlayersControls';
import { PLAYERS_COLORS, PLAYERS_FONTS } from './playersTheme';

const TILE_GREEN = require('../../../assets/players/players-tile-green.png');
const TOTL_LOGO = Asset.fromModule(require('../../../assets/players/players-review-totl.svg')).uri;
const WORDMARK = Asset.fromModule(require('../../../assets/players/players-review-wordmark.svg')).uri;

/** Pattern tile is 163.73pt; the design's grid starts at (-49, -127). */
const TILE_OFFSET = { x: -49, y: -127 };
const TILE_FIELD = { width: 520, height: 1180 };

type RowStatus = 'correct' | 'wrong' | 'unplayed';

const STATUS_ICON: Record<RowStatus, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  correct: { name: 'checkmark-circle', color: PLAYERS_COLORS.brand },
  wrong: { name: 'close-circle', color: PLAYERS_COLORS.red },
  unplayed: { name: 'remove-circle', color: PLAYERS_COLORS.white },
};

/**
 * Post-game review (Figma 101:24513): every player in today's run, their club,
 * and how it went. Continue moves on to the score card and Share score.
 */
export default function PlayersReview({
  cards,
  outcomes,
  onContinue,
}: {
  cards: PlayersCard[];
  outcomes: PlayersRoundOutcome[];
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  const byId = React.useMemo(() => new Map(outcomes.map((o) => [o.card.id, o])), [outcomes]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Football pattern, washed dark navy (design: brand tiles under a 90% navy multiply). */}
      <View style={[StyleSheet.absoluteFill, styles.ground]}>
        <Image
          source={TILE_GREEN}
          resizeMode="repeat"
          fadeDuration={0}
          style={{ position: 'absolute', left: TILE_OFFSET.x, top: TILE_OFFSET.y, ...TILE_FIELD }}
        />
        <View style={[StyleSheet.absoluteFill, styles.wash]} />
      </View>

      <View style={{ flex: 1, paddingTop: Math.max(insets.top - 19, 12), paddingBottom: Math.max(insets.bottom, 16) + 33 }}>
        <View style={styles.header} accessibilityRole="header" accessibilityLabel="TotL · The Players">
          <SvgUri uri={TOTL_LOGO} width={61.2} height={54.6} />
          <SvgUri uri={WORDMARK} width={95.29} height={50.4} />
        </View>

        {/* Sits just above Continue as in the design; scrolls on short phones. */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {cards.map((card) => {
            const outcome = byId.get(card.id);
            const status: RowStatus = !outcome ? 'unplayed' : outcome.correct ? 'correct' : 'wrong';
            const badge = TEAM_BADGES[normalizeTeamCode(card.correct.clubCode)] ?? null;
            const icon = STATUS_ICON[status];
            return (
              <View
                key={card.id}
                style={styles.row}
                accessible
                accessibilityLabel={`${card.playerName}, ${card.correct.clubName}, ${
                  status === 'unplayed' ? 'not played' : status
                }`}
              >
                <View style={styles.badge}>
                  {badge ? <Image source={badge} style={styles.badge} resizeMode="contain" /> : null}
                </View>
                <TotlText style={styles.name} numberOfLines={1}>
                  {card.playerName}
                </TotlText>
                <Ionicons name={icon.name} size={32} color={icon.color} />
              </View>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: 20 }}>
          <PlayersButton label="Continue" onPress={onContinue} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: {
    backgroundColor: PLAYERS_COLORS.navy,
    overflow: 'hidden',
  },
  // The design washes brand-tinted grey tiles with 90% navy. Our tile is pre-tinted darker,
  // so a lighter wash lands on the same tones.
  wash: {
    backgroundColor: 'rgba(11,31,58,0.72)',
    mixBlendMode: 'multiply',
  },
  header: {
    height: 54.6,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: 16,
    paddingTop: 24,
    paddingBottom: 41,
  },
  row: {
    height: 32,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  badge: {
    width: 32,
    height: 32,
  },
  name: {
    flex: 1,
    paddingHorizontal: 4,
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.2,
    color: PLAYERS_COLORS.white,
  },
});
