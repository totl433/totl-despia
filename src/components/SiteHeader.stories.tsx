import type { Meta, StoryObj } from '@storybook/react'
import SiteHeader from './SiteHeader'

const meta: Meta<typeof SiteHeader> = {
  title: 'Components/Deprecated/SiteHeader',
  component: SiteHeader,
  parameters: {
    docs: {
      description: {
        component: '⚠️ **DEPRECATED** - This component is no longer used in the app. Kept for reference only.\n\nTop navigation bar that reads from the Auth context and router.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof SiteHeader>

const baseUser = {
  id: 'demo-user',
  email: 'demo@totl.app',
  user_metadata: { display_name: 'Demo User' },
}

export const DefaultUser: Story = {
  parameters: {
    auth: {
      user: baseUser,
    },
  },
}

export const AdminUser: Story = {
  parameters: {
    auth: {
      user: {
        ...baseUser,
        id: '4542c037-5b38-40d0-b189-847b8f17c222',
        user_metadata: { display_name: 'Admin Jof' },
      },
    },
  },
}
