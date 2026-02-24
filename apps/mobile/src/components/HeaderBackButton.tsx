import React from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import { useTokens } from '@totl/ui';
import { Ionicons } from '@expo/vector-icons';

export default function HeaderBackButton({
  onPress,
  accessibilityLabel = 'Back',
  color,
  size = 24,
  style,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  color?: string;
  size?: number;
  style?: ViewStyle;
}) {
  const t = useTokens();
  const iconColor = color ?? t.color.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Ionicons name="chevron-back" size={size} color={iconColor} />
    </Pressable>
  );
}

