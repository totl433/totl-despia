import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Screen, TotlText } from '@totl/ui'

const meta: Meta<typeof Preview> = {
  title: 'App/TotlText',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview() {
  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <TotlText variant="heading">Heading</TotlText>
        <TotlText variant="sectionTitle">LEADERBOARDS</TotlText>
        <TotlText variant="sectionSubtitle">Gameweek 22 Live Tables</TotlText>
        <TotlText variant="body">Body text</TotlText>
        <TotlText variant="muted">Muted text</TotlText>
        <TotlText variant="caption">Caption</TotlText>
        <TotlText variant="microMuted">Micro muted</TotlText>
      </View>
    </Screen>
  )
}

export const Variants: Story = {}

