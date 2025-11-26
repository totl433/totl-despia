import type { Meta, StoryObj } from '@storybook/react'
import FloatingProfile from './FloatingProfile'

const meta: Meta<typeof FloatingProfile> = {
  title: 'Components/FloatingProfile',
  component: FloatingProfile,
}

export default meta

type Story = StoryObj<typeof FloatingProfile>

export const Default: Story = {
  render: () => (
    <div style={{ minHeight: '50vh' }}>
      <FloatingProfile />
    </div>
  ),
}
