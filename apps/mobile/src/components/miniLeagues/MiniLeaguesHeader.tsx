import React from 'react';
import { Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

/**
 * Mini Leagues page header (title + subtitle + plus button).
 * The plus button is UI-only for now; wiring comes later.
 */
export default function MiniLeaguesHeader({
  title = 'Mini Leagues',
  subtitle = 'Create or join a private league with friends. Let the rivalry begin.',
  onPressAdd,
}: {
  title?: string;
  subtitle?: string;
  onPressAdd: () => void;
}) {
  const t = useTokens();
  const ADD_BUTTON_SIZE = 46; // match web (w-10/h-10) feel + Home icon sizing

  return (
    // NOTE: LeaguesScreen already applies list padding via FlatList `contentContainerStyle`.
    // Keep this header padding-free to avoid doubling and pushing the button down.
    <View style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <TotlText variant="sectionTitle">{title.toUpperCase()}</TotlText>
        <TotlText variant="sectionSubtitle" style={{ marginTop: 2 }}>
          {subtitle}
        </TotlText>
      </View>

      <Pressable
        onPress={onPressAdd}
        accessibilityRole="button"
        accessibilityLabel="Create or join mini league"
        style={({ pressed }) => ({
          width: ADD_BUTTON_SIZE,
          height: ADD_BUTTON_SIZE,
          borderRadius: 999,
          backgroundColor: t.color.brand,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 22, lineHeight: 22 }}>+</TotlText>
      </Pressable>
    </View>
  );
}

