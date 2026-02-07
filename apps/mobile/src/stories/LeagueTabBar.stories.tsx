import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import LeagueTabBar, { type LeagueTabKey } from '../components/league/LeagueTabBar';

const meta: Meta<typeof LeagueTabBar> = {
  title: 'league/LeagueTabBar',
  component: LeagueTabBar,
  decorators: [
    (Story) => (
      <Screen fullBleed>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LeagueTabBar>;

export const Default: Story = {
  args: {
    value: 'gwTable',
    onChange: () => {},
  },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = React.useState<LeagueTabKey>('gwTable');
    return (
      <Screen fullBleed>
        <LeagueTabBar value={value} onChange={setValue} />
      </Screen>
    );
  },
};
