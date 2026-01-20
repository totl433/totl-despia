import React from 'react';
import { Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export type LeagueTabKey = 'chat' | 'gwTable' | 'predictions' | 'season';

export default function LeagueTabBar({
  value,
  onChange,
}: {
  value: LeagueTabKey;
  onChange: (next: LeagueTabKey) => void;
}) {
  const t = useTokens();
  const tabs: Array<{ key: LeagueTabKey; label: string }> = [
    { key: 'chat', label: 'Chat' },
    { key: 'gwTable', label: 'GW Table' },
    { key: 'predictions', label: 'Predictions' },
    { key: 'season', label: 'Season' },
  ];

  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.color.border }}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              paddingVertical: 14,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <TotlText variant="caption" style={{ fontWeight: '900', color: active ? t.color.brand : t.color.muted }}>
              {tab.label}
            </TotlText>
            {active ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: t.color.brand,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

