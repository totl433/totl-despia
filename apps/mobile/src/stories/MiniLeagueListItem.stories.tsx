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
    submittedCount: 4,
    totalMembers: 4,
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
    submittedCount: 2,
    totalMembers: 3,
    membersPreview: [
      { id: '1', name: 'Alice Wonder' },
      { id: '2', name: 'Bob Builder' },
      { id: '3', name: 'Charlie' },
    ],
    onPress: () => {},
  },
};

