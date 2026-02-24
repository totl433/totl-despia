import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Screen } from '@totl/ui'
import RoundIconButton from '../../components/home/RoundIconButton'

const meta: Meta<typeof Preview> = {
  title: 'App/Home/RoundIconButton',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview() {
  const icon = require('../../../../../public/assets/Icons/School--Streamline-Outlined-Material-Pr0_White.png')
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <RoundIconButton icon={icon} onPress={() => {}} />
        <RoundIconButton icon={icon} onPress={() => {}} />
      </View>
    </Screen>
  )
}

export const Default: Story = {}

