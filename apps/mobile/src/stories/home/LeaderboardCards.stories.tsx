import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Screen } from '@totl/ui'
import { LeaderboardCardResultsCta } from '../../components/home/LeaderboardCards'

const meta: Meta<typeof Preview> = {
  title: 'App/Home/LeaderboardCards',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview() {
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <LeaderboardCardResultsCta gw={22} onPress={() => {}} />
      </View>
    </Screen>
  )
}

export const Default: Story = {}
