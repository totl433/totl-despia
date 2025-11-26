import type { Meta, StoryObj } from '@storybook/react'
import UserSwitcher from './UserSwitcher'

const meta: Meta<typeof UserSwitcher> = {
  title: 'Components/Deprecated/UserSwitcher',
  component: UserSwitcher,
  parameters: {
    docs: {
      description: {
        component: '⚠️ **DEPRECATED** - This component is no longer used in the app. Kept for reference only.\n\nDev-only helper that reads/writes the localStorage-backed dev auth user.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof UserSwitcher>

export const Default: Story = {
  render: () => {
    localStorage.removeItem('totl:dev_user')
    return <UserSwitcher />
  },
}
