import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import LeaderboardsTabs from '../components/leaderboards/LeaderboardsTabs';

const meta: Meta<typeof LeaderboardsTabs> = {
  title: 'leaderboards/LeaderboardsTabs',
  component: LeaderboardsTabs,
  decorators: [
    (Story) => (
      <Screen fullBleed style={{ padding: 16 }}>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LeaderboardsTabs>;

export const Default: Story = {
  args: {
    value: 'gw',
    onChange: () => {},
  },
};

