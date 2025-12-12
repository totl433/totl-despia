import type { Meta, StoryObj } from '@storybook/react'
import BottomNav from './BottomNav'
import { MemoryRouter } from 'react-router-dom'

type Story = StoryObj<typeof BottomNav>

const meta: Meta<typeof BottomNav> = {
  title: 'Components/BottomNav',
  component: BottomNav,
}

export default meta

export const HomeActive: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export const PredictionsActive: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/predictions']}>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export const MiniLeaguesActive: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/tables']}>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export const LeaderboardsActive: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/global']}>
        <Story />
      </MemoryRouter>
    ),
  ],
}
