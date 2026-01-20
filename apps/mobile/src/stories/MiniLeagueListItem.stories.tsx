import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import MiniLeagueListItem from '../components/miniLeagues/MiniLeagueListItem';

const meta: Meta<typeof MiniLeagueListItem> = {
  title: 'miniLeagues/MiniLeagueListItem',
  component: MiniLeagueListItem,
  decorators: [
    (Story) => (
      <Screen fullBleed style={{ padding: 16 }}>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof MiniLeagueListItem>;

export const AllSubmitted: Story = {
  args: {
    title: 'Prem Predictions',
    avatarUri: null,
    allSubmitted: true,
    membersCount: 4,
    userRank: 2,
    rankDelta: -1,
    membersPreview: [
      { id: '1', name: 'Jof' },
      { id: '2', name: 'Greg' },
      { id: '3', name: 'Carl' },
      { id: '4', name: 'Kieran' },
    ],
    onPress: () => {},
  },
};

export const Waiting: Story = {
  args: {
    title: 'Easy League',
    avatarUri: null,
    allSubmitted: false,
    membersCount: 3,
    userRank: null,
    rankDelta: null,
    membersPreview: [
      { id: '1', name: 'Alice Wonder' },
      { id: '2', name: 'Bob Builder' },
      { id: '3', name: 'Charlie' },
    ],
    onPress: () => {},
  },
};

