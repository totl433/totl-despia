import type { Meta, StoryObj } from '@storybook/react'
import { StreakCard } from './StreakCard'

const sampleScores = Array.from({ length: 10 }).map((_, idx) => ({
  gw: idx + 5,
  score: idx % 3 === 0 ? null : Math.max(0, 4 + (idx % 5)),
}))

const meta: Meta<typeof StreakCard> = {
  title: 'Components/StreakCard',
  component: StreakCard,
  args: {
    streak: 3,
    last10GwScores: sampleScores,
    latestGw: sampleScores[sampleScores.length - 1]?.gw ?? 10,
  },
}

export default meta

type Story = StoryObj<typeof StreakCard>

export const ActiveStreak: Story = {}

export const FreshStart: Story = {
  args: {
    streak: 0,
    last10GwScores: sampleScores.map((entry) => ({ ...entry, score: null })),
  },
}
