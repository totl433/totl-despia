import type { Meta, StoryObj } from '@storybook/react'
import GWPickMatrix from './GWPickMatrix'

const members = [
  { id: 'u1', name: 'Jof' },
  { id: 'u2', name: 'Carl Stratton' },
  { id: 'u3', name: 'Thomas Bird' },
]

const fixtures = [
  { id: 'F1', gw: 20, home: 'Arsenal', away: 'Chelsea' },
  { id: 'F2', gw: 20, home: 'Manchester City', away: 'Liverpool' },
  { id: 'F3', gw: 20, home: 'Tottenham Hotspur', away: 'Everton' },
]

const seedPicks = () => {
  const picks = {
    u1: { F1: 'H', F2: 'A' },
    u2: { F1: 'D', F2: 'H', F3: 'A' },
    u3: { F1: 'H', F2: 'D', F3: 'H' },
  }
  Object.entries(picks).forEach(([userId, map]) => {
    localStorage.setItem(`totl:picks:${userId}:20`, JSON.stringify(map))
  })
}

const meta: Meta<typeof GWPickMatrix> = {
  title: 'Components/GWPickMatrix',
  component: GWPickMatrix,
  args: {
    gw: 20,
    members,
    fixtures,
  },
}

export default meta

type Story = StoryObj<typeof GWPickMatrix>

export const WithSampleData: Story = {
  render: (args) => {
    seedPicks()
    return (
      <div className="max-w-4xl">
        <GWPickMatrix {...args} />
      </div>
    )
  },
}

export const EmptyState: Story = {
  args: {
    fixtures: [],
  },
}
