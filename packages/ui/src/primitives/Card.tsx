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
          backgroundColor: '#0F1B2E',
          borderRadius: t.radius.lg,
          padding: t.space[4],
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.2)',
        },
        style,
      ]}
    />
  );
}

