import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Screen } from '@totl/ui'
import PickPill from '../../components/home/PickPill'

const meta: Meta<typeof Preview> = {
  title: 'App/Home/PickPill',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview({ active }: { active: boolean }) {
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <PickPill label="Default View" active={active} />
        <PickPill label="Home Win" active={active} />
        <PickPill label="Draw" active={!active} />
      </View>
    </Screen>
  )
}

export const Active: Story = { args: { active: true } }
export const Inactive: Story = { args: { active: false } }

