import React from 'react';
import { useColorScheme } from 'react-native';

/**
 * Returns current theme preference. Uses system color scheme.
 */
export function useThemePreference() {
  const colorScheme = useColorScheme();
  return { isDark: colorScheme === 'dark' };
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
