import React from 'react';
import { View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export type LeagueFormLetter = 'W' | 'D' | 'L';

function FormPill({ v }: { v: LeagueFormLetter }) {
  const t = useTokens();
  const bg = v === 'W' ? 'rgba(34,197,94,0.18)' : v === 'D' ? 'rgba(148,163,184,0.22)' : 'rgba(239,68,68,0.18)';
  const fg = v === 'W' ? '#22C55E' : v === 'D' ? t.color.muted : '#EF4444';

  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.20)',
      }}
    >
      <TotlText variant="caption" style={{ fontWeight: '900', color: fg, lineHeight: 14 }}>
        {v}
      </TotlText>
    </View>
  );
}

/**
 * LeagueFormDisplay - shows last 5 results as pills (W/D/L).
 */
export default function LeagueFormDisplay({ form }: { form: LeagueFormLetter[] }) {
  const last5 = form.slice(-5);
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {last5.length ? last5.map((v, idx) => <FormPill key={`${v}-${idx}`} v={v} />) : <View style={{ height: 22 }} />}
    </View>
  );
}

