import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTokens } from '@totl/ui';

/**
 * The chats' own back chevron, in place of the system one. On iOS 26 and later the system back
 * button can come up as an empty glass circle on these headers; this one always draws.
 * Screens using it set `headerBackVisible: false`.
 */
export default function ChatHeaderBackButton({ onPress }: { onPress: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={10}
      style={({ pressed }) => ({ paddingHorizontal: 2, opacity: pressed ? 0.85 : 1, backgroundColor: 'transparent' })}
    >
      <Ionicons name="chevron-back" size={24} color={t.color.text} />
    </Pressable>
  );
}
