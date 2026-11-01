import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import StatsPlayersCard from '../components/profileStats/StatsPlayersCard';
import StatsPlayersTab from '../components/profileStats/StatsPlayersTab';

const meta: Meta<typeof StatsPlayersCard> = {
  title: 'App/Stats/PlayersCard',
  component: StatsPlayersCard,
  decorators: [
    (Story) => (
      <Screen>
        <View style={{ padding: 16 }}>
          <Story />
        </View>
      </Screen>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof StatsPlayersCard>;

export const Played: Story = {
  args: {
    todayScore: { correct: 7, total: 10 },
    onPress: () => {},
  },
};

export const NotPlayed: Story = {
  args: {
    todayScore: null,
    onPress: () => {},
  },
};

export const Tab: StoryObj<typeof StatsPlayersTab> = {
  render: () => (
    <StatsPlayersTab
      userId="me"
      onPressPlay={() => {}}
      scoresByUser={{
        me: {
          '2026-10-19': { correct: 10, total: 10 },
          '2026-10-20': { correct: 2, total: 10 },
          '2026-10-24': { correct: 7, total: 10 },
        },
        other: {
          '2026-10-24': { correct: 4, total: 10 },
        },
      }}
    />
  ),
};
