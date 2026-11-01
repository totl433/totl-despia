import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

import type { PlayersDayScore } from '../../lib/retroPlayers/scores';

/** Today's Players score — same white card as the other Stats metrics. */
export default function StatsPlayersCard({
  todayScore,
  onPress,
}: {
  todayScore: PlayersDayScore | null;
  onPress: () => void;
}) {
  const t = useTokens();
  const scoreLine = todayScore ? `${todayScore.correct}/${todayScore.total}` : '—';
  const label = todayScore
    ? `Today's score, ${todayScore.correct} of ${todayScore.total}`
    : "Today's score, play today";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.color.surface, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
        Today's score
      </TotlText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <TotlText style={[styles.score, { color: t.color.text }]}>{scoreLine}</TotlText>
        {!todayScore ? (
          <TotlText style={{ fontSize: 14, fontWeight: '400', color: '#475569', marginLeft: 8, lineHeight: 20 }}>
            Play today
          </TotlText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  score: {
    fontFamily: 'Gramatika-Bold',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
});
