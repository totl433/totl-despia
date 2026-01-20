import React from 'react';
import { SafeAreaView, View, type ViewProps } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';

export function Screen({ style, children, ...props }: ViewProps) {
  const t = useTokens();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.color.background }}>
      <View {...props} style={[{ flex: 1, padding: t.space[4] }, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

