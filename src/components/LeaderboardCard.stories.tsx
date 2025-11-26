import type { Meta, StoryObj } from '@storybook/react'
import { LeaderboardCard } from './LeaderboardCard'

const meta: Meta<typeof LeaderboardCard> = {
  title: 'Components/LeaderboardCard',
  component: LeaderboardCard,
  args: {
    title: '5-WEEK FORM',
    badgeSrc: '/assets/5-week-form-badge.png',
    linkTo: '/global?tab=form5',
    rank: 23,
    total: 250,
  },
}

export default meta

type Story = StoryObj<typeof LeaderboardCard>

export const Default: Story = {}

export const LastGameweek: Story = {
  args: {
    title: 'Last GW',
    variant: 'lastGw',
    linkTo: '/global?tab=lastgw',
    score: 8,
    totalFixtures: 10,
    gw: 14,
    rank: 12,
    total: 512,
  },
}

export const MissingData: Story = {
  args: {
    title: 'Season Rank',
    badgeSrc: '/assets/season-rank-badge.png',
    linkTo: '/global?tab=overall',
    rank: null,
    total: null,
  },
}
