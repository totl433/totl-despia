import React from 'react';
import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTokens } from '../theme/ThemeProvider';

export type ScreenProps = ViewProps & {
  fullBleed?: boolean;
  /** Override the default theme background (SafeArea + content). */
  backgroundColor?: string;
};

export function Screen({ style, children, fullBleed = false, backgroundColor, ...props }: ScreenProps) {
  const t = useTokens();
  const bg = backgroundColor ?? t.color.background;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: bg }}>
      <View {...props} style={[{ flex: 1, padding: fullBleed ? 0 : t.space[4] }, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

