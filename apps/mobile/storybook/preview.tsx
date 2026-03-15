import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider } from '@totl/ui'

export const decorators = [
  (Story: React.ComponentType) => (
    <SafeAreaProvider>
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    </SafeAreaProvider>
  ),
]

