import type { Meta, StoryObj } from '@storybook/react'
import UserSwitcher from './UserSwitcher'

const meta: Meta<typeof UserSwitcher> = {
  title: 'Components/UserSwitcher',
  component: UserSwitcher,
  parameters: {
    docs: {
      description: {
        component: 'Dev-only helper that reads/writes the localStorage-backed dev auth user.',
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
