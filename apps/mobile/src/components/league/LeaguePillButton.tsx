import React from 'react';
import { Pressable } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export default function LeaguePillButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: t.color.border,
        backgroundColor: t.color.surface,
        paddingHorizontal: 14,
        justifyContent: 'center',
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '800' }}>
        {label}
      </TotlText>
    </Pressable>
  );
}

