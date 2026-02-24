import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import { Screen } from '@totl/ui'

import PickPill from '../../components/home/PickPill'
import RoundIconButton from '../../components/home/RoundIconButton'
import SectionHeaderRow from '../../components/home/SectionHeaderRow'
import SectionTitle from '../../components/home/SectionTitle'
import { LeaderboardCardLastGw, LeaderboardCardSimple } from '../../components/home/LeaderboardCards'

const meta: Meta<typeof Preview> = {
  title: 'App/Home/BuildingBlocks',
  component: Preview,
}

export default meta
type Story = StoryObj<typeof Preview>

function Preview() {
  // from `apps/mobile/src/stories/home/*` to repo root is `../../../../../`
  const badge = require('../../../../../dist/assets/5-week-form-badge.png')
  const icon = require('../../../../../public/assets/Icons/Person--Streamline-Outlined-Material-Pro_white.png')

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <SectionTitle>Home blocks</SectionTitle>

        <SectionHeaderRow
          title="Mini Leagues"
          subtitle="Gameweek 22 Live Tables"
          right={<PickPill label="Default View" active />}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PickPill label="Home Win" active />
          <PickPill label="Draw" active={false} />
          <PickPill label="Away Win" active={false} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <RoundIconButton icon={icon} onPress={() => {}} />
          <RoundIconButton icon={icon} onPress={() => {}} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <LeaderboardCardLastGw gw={22} score="7" totalFixtures="10" displayText="Top 12%" onPress={() => {}} />
          <LeaderboardCardSimple title="5-WEEK FORM" badge={badge} displayText="Top 8%" onPress={() => {}} />
        </View>
      </View>
    </Screen>
  )
}

export const All: Story = {}

