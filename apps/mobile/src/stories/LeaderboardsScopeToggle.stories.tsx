import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import LeaderboardsScopeToggle from '../components/leaderboards/LeaderboardsScopeToggle';

const meta: Meta<typeof LeaderboardsScopeToggle> = {
  title: 'leaderboards/LeaderboardsScopeToggle',
  component: LeaderboardsScopeToggle,
  decorators: [
    (Story) => (
      <Screen fullBleed style={{ padding: 16 }}>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LeaderboardsScopeToggle>;

export const Default: Story = {
  args: {
    value: 'all',
    onChange: () => {},
  },
};

