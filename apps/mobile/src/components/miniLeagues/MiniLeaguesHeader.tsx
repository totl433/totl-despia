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

  return (
    <View style={{ paddingHorizontal: t.space[4], paddingTop: t.space[3], paddingBottom: t.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TotlText variant="heading" style={{ letterSpacing: 0.6 }}>
          {title.toUpperCase()}
        </TotlText>

        <Pressable
          onPress={onPressAdd}
          accessibilityRole="button"
          accessibilityLabel="Create or join mini league"
          style={({ pressed }) => ({
            width: 62,
            height: 62,
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
          <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 30, lineHeight: 30 }}>+</TotlText>
        </Pressable>
      </View>

      <TotlText variant="muted" style={{ marginTop: 10, maxWidth: 520 }}>
        {subtitle}
      </TotlText>
    </View>
  );
}

