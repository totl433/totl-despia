import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { Screen } from '@totl/ui'

import TopStatusBanner from '../../components/home/TopStatusBanner'

const meta: Meta<typeof TopStatusBanner> = {
  title: 'App/Home/TopStatusBanner',
  component: TopStatusBanner,
}

export default meta
type Story = StoryObj<typeof TopStatusBanner>

export const ComingSoon: Story = {
  render: () => (
    <Screen>
      <TopStatusBanner title="Gameweek 27 coming soon" icon="info" />
    </Screen>
  ),
}

export const ReadyToMoveOn: Story = {
  render: () => (
    <Screen>
      <TopStatusBanner
        title="Ready to move on?"
        icon="flash"
        actionLabel="Gameweek 27"
        actionAccessibilityLabel="Move to next gameweek"
        onActionPress={() => {}}
      />
    </Screen>
  ),
}

export const GenericInfo: Story = {
  render: () => (
    <Screen>
      <TopStatusBanner title="Maintenance tonight at 10pm" icon="info" />
    </Screen>
  ),
}
