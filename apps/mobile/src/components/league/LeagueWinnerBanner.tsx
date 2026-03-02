import React from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';

import WinnerShimmer from '../WinnerShimmer';

export interface LeagueWinnerBannerProps {
  winnerName: string;
  isDraw: boolean;
  /** When provided, overrides winnerName/isDraw. Supports multiple joint winners. */
  winnerNames?: string[];
  /** Custom title (e.g. "Player of the Month"). Use titlePlural for 2+ winners. When set, renders heading + name tabs layout. */
  title?: string;
  titlePlural?: string;
  /** When true with title+winnerNames, only render winner cards (no heading). For use when heading is rendered elsewhere. */
  compact?: boolean;
  /** Avatar URLs for each winner, same order as winnerNames. Optional. */
  winnerAvatarUrls?: (string | null)[];
}

function initial1(name: string): string {
  const s = name.trim();
  if (!s) return '?';
  return s.slice(0, 1).toUpperCase();
}

function WinnerTab({ name, avatarUrl, index }: { name: string; avatarUrl?: string | null; index: number }) {
  const t = useTokens();
  const AVATAR_SIZE = 24;
  return (
    <Animated.View
      entering={FadeIn.duration(280).delay(index * 80)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.color.surface,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginLeft: index > 0 ? 8 : 0,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, marginRight: 8 }} />
      ) : (
        <View
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            backgroundColor: t.color.surface2,
            borderWidth: 1,
            borderColor: t.color.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
          }}
        >
          <TotlText variant="caption" style={{ fontFamily: t.font.medium, fontSize: 12 }}>{initial1(name)}</TotlText>
        </View>
      )}
      <TotlText style={{ marginRight: 6, fontSize: 16 }}>🏅</TotlText>
      <TotlText style={{ color: t.color.text, fontFamily: t.font.medium, fontSize: 14 }} numberOfLines={1}>
        {name}
      </TotlText>
    </Animated.View>
  );
}

function formatWinnerText(props: LeagueWinnerBannerProps): string {
  const { winnerName, isDraw, winnerNames, title } = props;
  if (winnerNames && winnerNames.length > 0 && !title) {
    const names =
      winnerNames.length === 1
        ? winnerNames[0]
        : winnerNames.length === 2
          ? `${winnerNames[0]} & ${winnerNames[1]}`
          : winnerNames.length === 3
            ? `${winnerNames[0]}, ${winnerNames[1]} & ${winnerNames[2]}`
            : `${winnerNames[0]}, ${winnerNames[1]} & ${winnerNames[2]} +${winnerNames.length - 3}`;
    return winnerNames.length === 1 ? `${names} Wins!` : `${names} Win!`;
  }
  return isDraw ? "It's a Draw!" : `${winnerName} Wins!`;
}

/**
 * LeagueWinnerBanner - Winner banner for a finished GW table.
 * Mirrors web behavior: only show when the GW is finished.
 * Supports multiple joint winners via winnerNames.
 * When title is provided, renders heading + name tabs (one per winner).
 */
export default function LeagueWinnerBanner({ winnerName, isDraw, winnerNames, winnerAvatarUrls, title, titlePlural, compact }: LeagueWinnerBannerProps) {
  const t = useTokens();
  const useTabsLayout = !!(title && winnerNames && winnerNames.length > 0);
  const text = useTabsLayout ? null : formatWinnerText({ winnerName, isDraw, winnerNames, title, titlePlural });
  const headingText = useTabsLayout ? (winnerNames!.length === 1 ? title! : (titlePlural ?? title!)) : null;

  if (useTabsLayout) {
    return (
      <View style={{ marginTop: compact ? 8 : t.space[3], marginBottom: t.space[3], alignItems: 'center' }}>
        {!compact ? (
          <TotlText
            variant="sectionSubtitle"
            style={{ fontFamily: t.font.medium, marginBottom: 8, textAlign: 'center' }}
          >
            {headingText}
          </TotlText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          {winnerNames!.map((name, i) => (
            <WinnerTab key={name} name={name} avatarUrl={winnerAvatarUrls?.[i] ?? null} index={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        paddingHorizontal: t.space[4],
        paddingVertical: t.space[4],
        marginTop: t.space[3],
        marginBottom: t.space[3],
      }}
    >
      <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.9} tint="white" />
      <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
      <View style={{ alignItems: 'center' }}>
        <TotlText style={{ color: '#FFFFFF', fontFamily: t.font.medium, textAlign: 'center' }}>
          {text}
        </TotlText>
      </View>
    </LinearGradient>
  );
}

