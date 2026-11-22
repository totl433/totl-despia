import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { TotlText } from '@totl/ui';
import type { PlayersShootoutKick, PlayersShootoutRound } from '@totl/api-client';

import { shootoutClubName } from '../../lib/retroPlayers/shootout';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import { PLAYERS_COLORS, PLAYERS_FONTS } from './playersTheme';

function Mark({ correct, size = 18 }: { correct: boolean; size?: number }) {
  const fill = correct ? PLAYERS_COLORS.brand : PLAYERS_COLORS.red;
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={10} fill={fill} />
      {correct ? (
        <Path d="M7 11.4l2.6 2.6L15 8.6" stroke={PLAYERS_COLORS.white} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Path d="M8 8l6 6M14 8l-6 6" stroke={PLAYERS_COLORS.white} strokeWidth={2.2} strokeLinecap="round" />
      )}
    </Svg>
  );
}

function pickLabel(round: PlayersShootoutRound, kick: PlayersShootoutKick): string {
  if (!kick.played) return 'Still to play';
  if (kick.timedOut) return 'Ran out of time';
  return shootoutClubName(round.card, kick.pick) ?? 'Hidden';
}

/**
 * One card of a game: who the player was, the right club, and what each of you picked.
 * `light` is for the navy result moment; otherwise it sits on paper.
 */
export function ShootoutRoundRow({
  round,
  themName,
  meFirst = true,
  light = false,
}: {
  round: PlayersShootoutRound;
  themName: string;
  /** Home side first: false when the other player is the challenger. */
  meFirst?: boolean;
  light?: boolean;
}) {
  const ink = light ? PLAYERS_COLORS.white : PLAYERS_COLORS.inkSoft;
  const soft = light ? PLAYERS_COLORS.whiteSoft : PLAYERS_COLORS.muted;
  const card = round.card;
  const badge = card?.correct ? TEAM_BADGES[normalizeTeamCode(card.correct.clubCode)] ?? null : null;
  return (
    <View style={styles.round}>
      <View style={styles.roundHead}>
        {badge ? <Image source={badge} style={{ width: 28, height: 28 }} resizeMode="contain" /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <TotlText style={[styles.roundPlayer, { color: ink }]} numberOfLines={1}>
            {card ? card.playerName : `Card ${round.number}`}
            {card?.questionSeason ? <TotlText style={[styles.roundSeason, { color: soft }]}> · {card.questionSeason}</TotlText> : null}
          </TotlText>
          {card?.correct ? (
            <TotlText style={[styles.roundAnswer, { color: soft }]} numberOfLines={1}>
              {card.correct.clubName}
            </TotlText>
          ) : null}
        </View>
      </View>
      {[
        ...(meFirst
          ? ([
              ['You', round.me],
              [themName, round.them],
            ] as const)
          : ([
              [themName, round.them],
              ['You', round.me],
            ] as const)),
      ].map(([who, kick]) => (
        <View key={who} style={styles.pickRow}>
          <TotlText style={[styles.pickWho, { color: soft }]} numberOfLines={1}>
            {who}
          </TotlText>
          {kick.played && kick.correct != null ? <Mark correct={!!kick.correct} /> : <View style={{ width: 18 }} />}
          <TotlText style={[styles.pickClub, { color: ink }]} numberOfLines={1}>
            {pickLabel(round, kick)}
          </TotlText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  round: { gap: 6 },
  roundHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundPlayer: { fontFamily: PLAYERS_FONTS.medium, fontSize: 16, lineHeight: 20 },
  roundSeason: { fontFamily: PLAYERS_FONTS.body, fontSize: 14 },
  roundAnswer: { fontFamily: PLAYERS_FONTS.body, fontSize: 13, lineHeight: 17 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 38 },
  pickWho: { width: 76, fontFamily: PLAYERS_FONTS.body, fontSize: 14 },
  pickClub: { flex: 1, fontFamily: PLAYERS_FONTS.medium, fontSize: 14 },
});
