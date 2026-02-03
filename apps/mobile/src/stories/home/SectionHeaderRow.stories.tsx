import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Screen } from '@totl/ui'
import PickPill from '../../components/home/PickPill'
import SectionHeaderRow from '../../components/home/SectionHeaderRow'

const meta: Meta<typeof Preview> = {
  title: 'App/Home/SectionHeaderRow',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview({ subtitle, withRight }: { subtitle: boolean; withRight: boolean }) {
  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <SectionHeaderRow
          title="Mini leagues"
          subtitle={subtitle ? 'Gameweek 22 Live Tables' : undefined}
          right={withRight ? <PickPill label="Default View" active /> : null}
        />
        <SectionHeaderRow title="Predictions" titleRight="0/10" />
      </View>
    </Screen>
  )
}

export const Basic: Story = { args: { subtitle: true, withRight: true } }
export const NoRight: Story = { args: { subtitle: true, withRight: false } }
export const NoSubtitle: Story = { args: { subtitle: false, withRight: true } }

