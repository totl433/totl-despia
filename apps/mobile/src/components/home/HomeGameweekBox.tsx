import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText } from '@totl/ui';

const BRAND = '#1C8376';

/** "Sat 12:30" in the viewer's time zone. */
function formatDeadline(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${time}`;
}

type Props =
  | { kind: 'deadline'; deadlineMs: number | null; expired: boolean; onPress: () => void }
  | { kind: 'comingSoon'; nextGw: number | null; lastGw: number | null; lastScore: string | null };

/**
 * Gameweek message beside The Players card on home (Figma "information box"):
 * the predictions deadline until picks are in, or "coming soon" with last week's score.
 */
export default function HomeGameweekBox(props: Props) {
  if (props.kind === 'deadline') {
    const { deadlineMs, expired, onPress } = props;
    const deadlineText = deadlineMs != null ? formatDeadline(deadlineMs) : null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Gameweek predictions, deadline ${deadlineText ?? 'not set'}`}
        disabled={expired}
        onPress={onPress}
        style={({ pressed }) => [styles.box, { opacity: expired ? 0.6 : pressed ? 0.92 : 1 }]}
      >
        <View style={styles.content}>
          <TotlText style={styles.title}>{'Gameweek\nPredictions'}</TotlText>
          <View style={{ gap: 2 }}>
            <TotlText style={styles.body}>Deadline:</TotlText>
            <TotlText style={[styles.body, { color: expired ? '#64748B' : BRAND }]}>{deadlineText ?? '—'}</TotlText>
          </View>
        </View>
        <View style={[styles.go, { backgroundColor: expired ? '#94A3B8' : BRAND }]}>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </View>
      </Pressable>
    );
  }

  const { nextGw, lastGw, lastScore } = props;
  return (
    <View style={styles.box} accessible accessibilityLabel={`Gameweek ${nextGw ?? ''} coming soon`}>
      <View style={styles.content}>
        <View style={{ gap: 2 }}>
          <TotlText style={styles.title}>{nextGw != null ? `Gameweek ${nextGw}` : 'Gameweek'}</TotlText>
          <TotlText style={styles.body}>Coming soon</TotlText>
        </View>
        {lastScore && lastGw != null ? (
          <TotlText style={[styles.body, { color: BRAND }]}>{`GW ${lastGw}: ${lastScore}`}</TotlText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 143,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CED5D2',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 15,
    right: 15,
    top: 15,
    gap: 12,
  },
  title: {
    fontFamily: 'Gramatika-Medium',
    fontSize: 18,
    lineHeight: 21.6,
    color: '#0A0A0A',
  },
  body: {
    fontFamily: 'Gramatika-Regular',
    fontSize: 16,
    lineHeight: 20,
    color: '#202020',
  },
  go: {
    position: 'absolute',
    right: 11.3,
    bottom: 11,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
