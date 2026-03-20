import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider } from '@totl/ui'
import { lightThemeTokens } from '../src/lib/lightThemeTokens'

/** Match app light theme tokens (`AppRoot`) so Storybook matches production Home. */
export const decorators = [
  (Story: React.ComponentType) => (
    <SafeAreaProvider>
      <ThemeProvider tokens={lightThemeTokens}>
        <Story />
      </ThemeProvider>
    </SafeAreaProvider>
  ),
]

