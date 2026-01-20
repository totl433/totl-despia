import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { Screen } from '@totl/ui'
import MiniLeagueCard, { type MiniLeagueTableRow } from '../components/MiniLeagueCard'

const meta: Meta<typeof MiniLeagueCardStory> = {
  title: 'App/MiniLeagueCard',
  component: MiniLeagueCardStory,
}

export default meta
type Story = StoryObj<typeof MiniLeagueCardStory>

function MiniLeagueCardStory({ gwIsLive, winnerChip }: { gwIsLive: boolean; winnerChip: string | null }) {
  const rows: MiniLeagueTableRow[] = [
    { user_id: 'u1', name: 'Carl', score: 4, unicorns: 1 },
    { user_id: 'u2', name: 'Jof', score: 4, unicorns: 1 },
    { user_id: 'u3', name: 'SP', score: 2, unicorns: 1 },
    { user_id: 'u4', name: 'ThomasJamesBird', score: 1, unicorns: 0 },
  ]

  return (
    <Screen>
      <MiniLeagueCard
        title="Prem Predictions"
        avatarUri={null}
        gwIsLive={gwIsLive}
        winnerChip={winnerChip}
        rows={rows}
        showUnicorns
      />
    </Screen>
  )
}

export const Winner: Story = { args: { gwIsLive: false, winnerChip: 'Draw!' } }
export const LiveNoWinner: Story = { args: { gwIsLive: true, winnerChip: null } }

