import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'totl-theme-preference';
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

/**
 * Hook for managing theme (light/dark mode)
 * 
 * Features:
 * - Respects system preference by default
 * - Allows manual override via toggle
 * - Persists preference in localStorage
 * - Syncs with system preference changes when no manual override
 * 
 * Usage:
 * ```tsx
 * const { theme, toggleTheme, isDark } = useTheme();
 * ```
 */
export function useTheme() {
  // Get initial theme from localStorage or system preference
  const getInitialTheme = (): Theme => {
    // Check localStorage first
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored as Theme;
    }
    
    // Fall back to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Default to light if no preference available
    return 'light';
  };

  // User/system preference (may be overridden on desktop)
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [isManualOverride, setIsManualOverride] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) !== null;
  });
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  });

  // Track desktop breakpoint so we can force light theme on desktop only.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
    };

    // Set initial (in case SSR/hydration mismatches)
    setIsDesktop(mql.matches);

    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }

    // Fallback for older browsers
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  // Apply theme to HTML element
  useEffect(() => {
    const appliedTheme: Theme = isDesktop ? 'light' : theme;
    const root = document.documentElement;
    if (appliedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, isDesktop]);

  // Listen for system preference changes (only if no manual override)
  useEffect(() => {
    if (isManualOverride) {
      // User has manually set preference, don't sync with system
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } 
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [isManualOverride]);

  // Toggle theme and save to localStorage
  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setIsManualOverride(true);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  // Set theme explicitly
  const setThemeExplicit = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsManualOverride(true);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  // Reset to system preference
  const resetToSystem = () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    setIsManualOverride(false);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(systemTheme);
  };

  const appliedTheme: Theme = isDesktop ? 'light' : theme;

  return {
    theme: appliedTheme,
    isDark: appliedTheme === 'dark',
    isLight: appliedTheme === 'light',
    toggleTheme,
    setTheme: setThemeExplicit,
    resetToSystem,
    isManualOverride,
    isDesktop,
  };
}

