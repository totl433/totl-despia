import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { Screen } from '@totl/ui'
import MiniLeaguesDefaultList from '../components/MiniLeaguesDefaultList'

const meta: Meta<typeof Preview> = {
  title: 'App/MiniLeaguesDefaultList',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview() {
  return (
    <Screen>
      <MiniLeaguesDefaultList
        leagues={[
          { id: 'l1', name: 'aaa Carl', avatarUri: null },
          { id: 'l2', name: 'Easy League', avatarUri: null },
          { id: 'l3', name: 'FC Football', avatarUri: null },
          { id: 'l4', name: 'form', avatarUri: null },
          { id: 'l5', name: 'great', avatarUri: null },
          { id: 'l6', name: 'Jof', avatarUri: null },
        ]}
        onLeaguePress={() => {}}
      />
    </Screen>
  )
}

export const Default: Story = {}

