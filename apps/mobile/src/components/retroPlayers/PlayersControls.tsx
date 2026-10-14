import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { TotlText } from '@totl/ui';

import type { PlayersClubOption } from '../../lib/retroPlayers/buildPuzzle';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import { PLAYERS_COLORS, PLAYERS_FONTS } from './playersTheme';

/** Three club tiles under the card (design: 112.33 × 93, 9pt apart). */
export function PlayersAnswerTiles({
  options,
  hotIndex,
  correctCode,
  disabled,
  onPick,
}: {
  options: PlayersClubOption[];
  /** Tile the current drag is pointing at. */
  hotIndex: number | null;
  /** On reveal, the right answer is highlighted. */
  correctCode?: string | null;
  disabled: boolean;
  onPick: (opt: PlayersClubOption) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 9 }}>
      {options.map((opt, i) => {
        const badge = TEAM_BADGES[normalizeTeamCode(opt.clubCode)] ?? null;
        const hot = hotIndex === i || (correctCode != null && correctCode === opt.clubCode);
        return (
          <Pressable
            key={opt.clubCode}
            accessibilityRole="button"
            accessibilityLabel={opt.clubName}
            disabled={disabled}
            onPress={() => onPick(opt)}
            style={({ pressed }) => [
              styles.tile,
              hot && styles.tileHot,
              { transform: [{ scale: pressed || hotIndex === i ? 1.03 : 1 }] },
            ]}
          >
            <View style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
              {badge ? <Image source={badge} style={{ width: 46, height: 46 }} resizeMode="contain" /> : null}
            </View>
            <TotlText style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {opt.clubName}
            </TotlText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ArrowRight() {
  return (
    <Svg width={18} height={16} viewBox="0 0 16 14" fill="none">
      <Path
        d="M1 7h13.5M8.5 1l6 6-6 6"
        stroke={PLAYERS_COLORS.white}
        strokeWidth={2.18}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Full-width primary button. `gold` is the new-personal-best Share score. */
export function PlayersButton({
  label,
  onPress,
  tone = 'green',
  arrow = false,
  glow = false,
  busy = false,
  height = 93,
}: {
  label: string;
  onPress: () => void;
  tone?: 'green' | 'gold';
  arrow?: boolean;
  glow?: boolean;
  busy?: boolean;
  height?: number;
}) {
  const content = (
    <View style={styles.buttonInner}>
      {busy ? (
        <ActivityIndicator color={PLAYERS_COLORS.white} />
      ) : (
        <>
          <TotlText style={styles.buttonLabel}>{label}</TotlText>
          {arrow ? <ArrowRight /> : null}
        </>
      )}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { height, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
        glow && styles.glow,
        tone === 'green' && { backgroundColor: PLAYERS_COLORS.brand },
      ]}
    >
      {tone === 'gold' ? (
        <LinearGradient
          colors={[PLAYERS_COLORS.goldStart, PLAYERS_COLORS.goldEnd]}
          start={{ x: 0, y: 0.4 }}
          end={{ x: 1, y: 0.6 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
        />
      ) : null}
      {content}
    </Pressable>
  );
}

/** Quiet text link (Rules, Scoreboard, Practice mode). */
export function PlayersTextLink({
  label,
  onPress,
  color = PLAYERS_COLORS.inkSoft,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <TotlText style={{ fontFamily: PLAYERS_FONTS.body, fontSize: 16, lineHeight: 20.8, color }}>{label}</TotlText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    height: 93,
    padding: 8,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PLAYERS_COLORS.mist,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileHot: {
    backgroundColor: PLAYERS_COLORS.brand,
    borderColor: PLAYERS_COLORS.brand,
  },
  tileLabel: {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    color: PLAYERS_COLORS.white,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    shadowColor: 'rgb(248,194,61)',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonLabel: {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.084,
    color: PLAYERS_COLORS.white,
  },
});
