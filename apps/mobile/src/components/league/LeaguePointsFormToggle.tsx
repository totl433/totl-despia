import React from 'react';
import { Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

/**
 * LeaguePointsFormToggle - Toggle between Points and Form views on Season tab.
 */
export default function LeaguePointsFormToggle({
  showForm,
  onToggle,
}: {
  showForm: boolean;
  onToggle: (next: boolean) => void;
}) {
  const t = useTokens();

  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: 999,
        padding: 2,
        borderWidth: 1,
        borderColor: t.color.border,
        backgroundColor: t.color.surface2,
      }}
    >
      <Pressable
        onPress={() => onToggle(false)}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: !showForm ? t.color.brand : 'transparent',
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <TotlText variant="caption" style={{ fontWeight: '900', color: !showForm ? '#FFFFFF' : t.color.muted }}>
          Points
        </TotlText>
      </Pressable>

      <Pressable
        onPress={() => onToggle(true)}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: showForm ? t.color.brand : 'transparent',
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <TotlText variant="caption" style={{ fontWeight: '900', color: showForm ? '#FFFFFF' : t.color.muted }}>
          Form
        </TotlText>
      </Pressable>
    </View>
  );
}

