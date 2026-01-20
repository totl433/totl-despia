import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Screen } from '@totl/ui'
import { LeaderboardCardLastGw, LeaderboardCardSimple } from '../../components/home/LeaderboardCards'

const meta: Meta<typeof Preview> = {
  title: 'App/Home/LeaderboardCards',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview() {
  const badge = require('../../../../../dist/assets/5-week-form-badge.png')
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <LeaderboardCardLastGw gw={22} score="7" totalFixtures="10" displayText="Top 12%" onPress={() => {}} />
        <LeaderboardCardSimple title="5-WEEK FORM" badge={badge} displayText="Top 8%" onPress={() => {}} />
      </View>
    </Screen>
  )
}

export const Default: Story = {}

