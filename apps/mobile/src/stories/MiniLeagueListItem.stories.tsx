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
      { id: '1', name: 'Jof', hasSubmitted: true },
      { id: '2', name: 'Greg', hasSubmitted: true },
      { id: '3', name: 'Carl', hasSubmitted: true },
      { id: '4', name: 'Kieran', hasSubmitted: true },
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
      { id: '1', name: 'Alice Wonder', hasSubmitted: true },
      { id: '2', name: 'Bob Builder', hasSubmitted: false },
      { id: '3', name: 'Charlie', hasSubmitted: false },
    ],
    onPress: () => {},
  },
};

