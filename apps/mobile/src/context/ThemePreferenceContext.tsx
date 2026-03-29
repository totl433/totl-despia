import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  resolved: ResolvedScheme;
  setPreference: (p: ThemePreference) => void;
  isDark: boolean;
}

const STORAGE_KEY = 'totl.themePreference';

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  preference: 'system',
  resolved: 'light',
  setPreference: () => {},
  isDark: false,
});

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const resolved: ResolvedScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value: ThemePreferenceContextValue = {
    preference,
    resolved,
    setPreference,
    isDark: resolved === 'dark',
  };

  if (!loaded) return null;

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
