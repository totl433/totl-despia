import type { Meta, StoryObj } from '@storybook/react'
import BottomNav from './BottomNav'

type Story = StoryObj<typeof BottomNav>

const meta: Meta<typeof BottomNav> = {
  title: 'Components/BottomNav',
  component: BottomNav,
}

export default meta

export const HomeActive: Story = {
  parameters: {
    initialEntries: ['/'],
  },
}

export const MiniLeaguesActive: Story = {
  parameters: {
    initialEntries: ['/tables'],
  },
}
