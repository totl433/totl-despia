/**
 * Light theme overrides — must match `AppRoot` so Storybook + HP Simulator
 * match the same production Home appearance as the main app in light mode.
 */
export const lightThemeTokens = {
  color: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surface2: '#E2E8F0',
    text: '#0F172A',
    muted: '#64748B',
    border: 'rgba(15,23,42,0.10)',
  },
} as const;
