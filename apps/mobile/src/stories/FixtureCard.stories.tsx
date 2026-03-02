import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { Screen } from '@totl/ui'
import FixtureCard, { type FixtureLike, type LiveScoreLike, type Pick } from '../components/FixtureCard'

const meta: Meta<typeof FixtureCardStory> = {
  title: 'App/FixtureCard',
  component: FixtureCardStory,
}

export default meta
type Story = StoryObj<typeof FixtureCardStory>

function FixtureCardStory({ pick, status }: { pick: Pick; status: 'FINISHED' | 'IN_PLAY' }) {
  const fixture: FixtureLike = {
    id: 'fx-1',
    fixture_index: 1,
    home_code: 'MUN',
    away_code: 'MCI',
    home_team: 'Manchester United',
    away_team: 'Manchester City',
    kickoff_time: '2026-01-17T15:00:00Z',
  }

  const liveScore: LiveScoreLike = {
    status,
    minute: status === 'IN_PLAY' ? 72 : 90,
    home_score: 2,
    away_score: 0,
    goals: [
      { team: 'Manchester United', scorer: 'Bryan Mbeumo', minute: 65 },
      { team: 'Manchester United', scorer: 'Patrick Dorgu', minute: 76 },
    ],
  }

  return (
    <Screen>
      <FixtureCard fixture={fixture} liveScore={liveScore} pick={pick} result={'H'} showPickButtons />
    </Screen>
  )
}

export const FinishedCorrect: Story = { args: { pick: 'H', status: 'FINISHED' } }
export const FinishedWrong: Story = { args: { pick: 'A', status: 'FINISHED' } }
export const LiveCorrect: Story = { args: { pick: 'H', status: 'IN_PLAY' } }

