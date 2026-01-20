import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TotlText, useTokens } from '@totl/ui';

import WinnerShimmer from '../WinnerShimmer';

export interface LeagueWinnerBannerProps {
  winnerName: string;
  isDraw: boolean;
}

/**
 * LeagueWinnerBanner - Winner banner for a finished GW table.
 * Mirrors web behavior: only show when the GW is finished.
 */
export default function LeagueWinnerBanner({ winnerName, isDraw }: LeagueWinnerBannerProps) {
  const t = useTokens();

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
        <TotlText style={{ color: '#FFFFFF', fontWeight: '900', textAlign: 'center' }}>
          {isDraw ? "It's a Draw!" : `${winnerName} Wins!`}
        </TotlText>
      </View>
    </LinearGradient>
  );
}

