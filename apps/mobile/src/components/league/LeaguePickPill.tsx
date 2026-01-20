import React from 'react';
import { View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export type LeaguePick = 'H' | 'D' | 'A';
export type LeaguePickTone = 'neutral' | 'picked' | 'correct' | 'wrong' | 'correctResult';

export default function LeaguePickPill({
  value,
  tone,
}: {
  value: LeaguePick;
  tone: LeaguePickTone;
}) {
  const t = useTokens();

  const styleFor = () => {
    if (tone === 'correct') return { bg: 'rgba(34,197,94,0.18)', border: '#22C55E', text: '#22C55E' };
    if (tone === 'wrong') return { bg: 'rgba(239,68,68,0.16)', border: '#EF4444', text: '#EF4444' };
    if (tone === 'picked') return { bg: t.color.brand, border: 'transparent', text: '#FFFFFF' };
    if (tone === 'correctResult') return { bg: t.color.surface2, border: '#22C55E', text: t.color.text };
    return { bg: t.color.surface2, border: t.color.border, text: t.color.text };
  };

  const s = styleFor();

  return (
    <View
      style={{
        minWidth: 34,
        paddingHorizontal: 10,
        height: 28,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: s.bg,
        borderWidth: 1,
        borderColor: s.border,
      }}
    >
      <TotlText variant="caption" style={{ fontWeight: '900', color: s.text, letterSpacing: 0.4 }}>
        {value}
      </TotlText>
    </View>
  );
}

