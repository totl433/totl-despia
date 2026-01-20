import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';

export function Card({ style, ...props }: ViewProps) {
  const t = useTokens();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: t.color.surface,
          borderRadius: t.radius.lg,
          padding: t.space[4],
          borderWidth: 1,
          borderColor: t.color.border,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 12,
          elevation: 4,
        },
        style,
      ]}
    />
  );
}

