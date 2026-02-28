import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { Screen } from '@totl/ui'
import { MiniLeaguesDefaultBatchCard } from '../components/MiniLeaguesDefaultList'

const meta: Meta<typeof Preview> = {
  title: 'App/MiniLeaguesDefaultBatchCard',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview() {
  return (
    <Screen>
      <MiniLeaguesDefaultBatchCard
        width={340}
        batch={[
          { id: 'l1', name: 'aaa Carl', avatarUri: null },
          { id: 'l2', name: 'AGI UNITED', avatarUri: null },
          { id: 'l3', name: 'Prem Predictions', avatarUri: null },
        ]}
        onLeaguePress={() => {}}
      />
    </Screen>
  )
}

export const Default: Story = {}

