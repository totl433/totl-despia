import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { Screen, ThemeProvider } from '@totl/ui'
import MiniLeagueCard, { type MiniLeagueTableRowWithAvatar } from '../components/MiniLeagueCard'

const meta: Meta<typeof MiniLeagueCardStory> = {
  title: 'App/MiniLeagueCard',
  component: MiniLeagueCardStory,
}

export default meta
type Story = StoryObj<typeof MiniLeagueCardStory>

function MiniLeagueCardStory({ rowCount }: { rowCount: 0 | 2 | 4 }) {
  const allRows: MiniLeagueTableRowWithAvatar[] = [
    { user_id: 'u1', name: 'Carl', score: 200, unicorns: 10, avatar_url: null },
    { user_id: 'u2', name: 'Jof', score: 180, unicorns: 8, avatar_url: null },
    { user_id: 'u3', name: 'SP', score: 160, unicorns: 6, avatar_url: null },
    { user_id: 'u4', name: 'ThomasJamesBird', score: 140, unicorns: 4, avatar_url: null },
  ]

  const rows = allRows.slice(0, rowCount)

  return (
    <Screen>
      <MiniLeagueCard
        title="Prem Predictions"
        avatarUri={null}
        gwIsLive={false}
        winnerChip={null}
        rows={rows}
        fixedRowCount={4}
        emptyLabel={rowCount === 0 ? 'Loading table…' : 'No table yet.'}
      />
    </Screen>
  )
}

export const Default: Story = { args: { rowCount: 4 } }
export const TwoRows: Story = { args: { rowCount: 2 } }
export const EmptyWithFixedHeight: Story = { args: { rowCount: 0 } }

export const LightMode: Story = {
  args: { rowCount: 4 },
  render: (args) => (
    <ThemeProvider
      tokens={{
        color: {
          background: '#F8FAFC',
          surface: '#FFFFFF',
          surface2: '#E2E8F0',
          text: '#0F172A',
          muted: '#475569',
          border: 'rgba(15,23,42,0.12)',
        },
      }}
    >
      <MiniLeagueCardStory {...args} />
    </ThemeProvider>
  ),
}

