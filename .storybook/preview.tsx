import type { Preview } from '@storybook/react-vite'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../src/context/AuthContext'
import '../src/index.css'

const defaultAuthValue = {
  user: {
    id: 'demo-user',
    email: 'demo@totl.app',
    user_metadata: { display_name: 'Demo User' },
  },
  session: null,
  loading: false,
  signOut: async () => {
    console.log('[storybook] signOut called')
  },
  showWelcome: false,
  dismissWelcome: () => {},
}

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const initialEntries = (context.parameters as any)?.initialEntries ?? ['/']
      const authOverrides = (context.parameters as any)?.auth ?? {}
      const authValue = { ...defaultAuthValue, ...authOverrides }

      return (
        <MemoryRouter initialEntries={initialEntries}>
          <AuthContext.Provider value={authValue}>
            <Story />
          </AuthContext.Provider>
        </MemoryRouter>
      )
    },
  ],
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    },

    themes: {
      default: 'light',
      list: [
        { name: 'light', class: '', color: '#f5f7f6' },
        { name: 'dark', class: 'dark', color: '#0f172a' },
      ],
    },
  },
};

export default preview;
