import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import LeaderboardTable from '../components/leaderboards/LeaderboardTable';

const meta: Meta<typeof LeaderboardTable> = {
  title: 'leaderboards/LeaderboardTable',
  component: LeaderboardTable,
  decorators: [
    (Story) => (
      <Screen fullBleed style={{ padding: 16 }}>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LeaderboardTable>;

export const Gw: Story = {
  args: {
    valueLabel: 'GW22',
    highlightUserId: 'me',
    rows: [
      { user_id: 'a', name: 'EB', value: 5 },
      { user_id: 'b', name: 'Joe Devine', value: 5 },
      { user_id: 'c', name: 'Jolly Joel', value: 5 },
      { user_id: 'd', name: 'Paul N', value: 5 },
      { user_id: 'e', name: 'Carl', value: 4 },
      { user_id: 'f', name: 'Dans13', value: 4 },
      { user_id: 'me', name: 'Jof', value: 4 },
      { user_id: 'g', name: 'Adam V', value: 3 },
    ],
  },
};

export const Monthly: Story = {
  args: {
    valueLabel: 'PTS',
    compactValueLabels: ['29', '30', '31'],
    compactLiveValueLabel: '31',
    highlightUserId: 'me',
    winnerUserIds: ['a'],
    rows: [
      { user_id: 'a', name: 'Joe Devine', value: 12, compactValues: [4, 4, 4] },
      { user_id: 'b', name: 'Ben New', value: 11, compactValues: [4, 4, 3] },
      { user_id: 'me', name: 'Jof', value: 10, compactValues: [3, 3, 4] },
      { user_id: 'c', name: 'EB', value: 9, compactValues: [3, 3, 3] },
      { user_id: 'd', name: 'Matthew Bird', value: 9, compactValues: [2, 3, 4] },
    ],
  },
};

