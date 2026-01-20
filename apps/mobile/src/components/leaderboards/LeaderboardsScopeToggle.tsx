import React from 'react';
import { Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export type LeaderboardsScope = 'all' | 'friends';

export default function LeaderboardsScopeToggle({
  value,
  onChange,
}: {
  value: LeaderboardsScope;
  onChange: (next: LeaderboardsScope) => void;
}) {
  const t = useTokens();
  const items: Array<{ key: LeaderboardsScope; label: string }> = [
    { key: 'all', label: 'All Players' },
    { key: 'friends', label: 'Mini League Friends' },
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
        maxWidth: 360,
        alignSelf: 'center',
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
              height: 40,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? t.color.brand : 'transparent',
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <TotlText variant="caption" style={{ fontWeight: '900', color: active ? '#FFFFFF' : t.color.muted }}>
              {it.label}
            </TotlText>
          </Pressable>
        );
      })}
    </View>
  );
}

