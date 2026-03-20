import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'totl-mobile-theme-preference';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  isDark: boolean;
  setPreference: (next: ThemePreference) => void;
  resetToSystem: () => void;
};

const ThemePreferenceContext = React.createContext<ThemePreferenceContextValue | null>(null);

export function useThemePreference() {
  const ctx = React.useContext(ThemePreferenceContext);
  const systemDark = useColorScheme() === 'dark';

  if (ctx) return ctx;

  return {
    preference: 'system' as const,
    effectiveTheme: systemDark ? ('dark' as const) : ('light' as const),
    isDark: systemDark,
    setPreference: () => {},
    resetToSystem: () => {},
  };
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemDark = useColorScheme() === 'dark';
  const [preference, setPreferenceState] = React.useState<ThemePreference>('system');

  React.useEffect(() => {
    let alive = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!alive) return;
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const setPreference = React.useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const resetToSystem = React.useCallback(() => {
    setPreferenceState('system');
    AsyncStorage.setItem(STORAGE_KEY, 'system').catch(() => {});
  }, []);

  const effectiveTheme: EffectiveTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  const value = React.useMemo<ThemePreferenceContextValue>(
    () => ({
      preference,
      effectiveTheme,
      isDark: effectiveTheme === 'dark',
      setPreference,
      resetToSystem,
    }),
    [effectiveTheme, preference, resetToSystem, setPreference]
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}
