import React from 'react';
import { Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export type LeaderboardsTab = 'gw' | 'form5' | 'form10' | 'overall';

export default function LeaderboardsTabs({
  value,
  onChange,
}: {
  value: LeaderboardsTab;
  onChange: (next: LeaderboardsTab) => void;
}) {
  const t = useTokens();

  const items: Array<{ key: LeaderboardsTab; label: string }> = [
    { key: 'gw', label: 'GW' },
    { key: 'form5', label: '5' },
    { key: 'form10', label: '10' },
    { key: 'overall', label: '🏆' },
  ];

  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: 'rgba(148,163,184,0.10)',
        padding: 6,
        flexDirection: 'row',
      }}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={({ pressed }) => ({
              flex: 1,
              height: 46,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? t.color.brand : 'transparent',
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <TotlText
              variant="body"
              style={{
                fontWeight: '900',
                color: active ? '#FFFFFF' : t.color.muted,
              }}
            >
              {it.label}
            </TotlText>
          </Pressable>
        );
      })}
    </View>
  );
}

