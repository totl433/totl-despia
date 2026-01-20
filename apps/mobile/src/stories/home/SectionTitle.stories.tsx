import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { Screen } from '@totl/ui'
import SectionTitle from '../../components/home/SectionTitle'

const meta: Meta<typeof Preview> = {
  title: 'App/Home/SectionTitle',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview({ text }: { text: string }) {
  return (
    <Screen>
      <SectionTitle>{text}</SectionTitle>
    </Screen>
  )
}

export const Default: Story = { args: { text: 'Mini Leagues' } }

